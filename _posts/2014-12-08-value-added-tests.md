---
layout: post
title: "Value Added Tests"
description: ""
category: 
tags:
  - testing
---
{% include JB/setup %}


**TL;DR**: high level acceptance test should focus, reveal and describe the value that a feature adds to the business.

This statement is obvious once you "get it", but may sound remote and abstract if you don't. So let us leave it hanging around for a while and check out this (slightly adapted) real world example.

Suppose we're a car retailer website. We'd like to introduce a "personal assistant" feature so that every time someone requests a quote, a member of our sales team gets assigned to it and an email introducing the assistant gets sent to the user. The auto assignment can be changed later from an admin interface.

We want to deliver early so we decide to break up the feature and first tackle the creation of "assistant profiles" for existing sales user accounts. After all, you can't assign anything if it does not exist yet. But, more importantly, some of the new code will end up in production without any public facing changes. So the rest of the new code will be smaller and therefore less disruptive to release. Plus, while we’re busy with the rest of the feature, someone from the sales team can go away and fill up the profiles.

We practice test driven development and the "outside in" approach, so we start with an integration test that looks like this (if this syntax - ruby/rspec - it does not look familiar, just assume that it does what you think it does):

{% highlight ruby %}
scenario 'create assistant profile' do
  # test data
  dave = create_sales_user()
  admin = create_admin_user()
  img = test_image()

  # create assistant profile
  visit admin_path()
  login(admin)
  click_link('Sales users')
  click_button('Edit')
  click_button('Create assistant profile')
  fill_in('name', with: 'Dave')
  attach_image(img)
  click_button('Save')

  # check if it has made it into db
  assert_assistant_profile_for_user(dave)
end
{% endhighlight %}


Looks pretty straightforward, so we make that happen and deploy to production. And off to implement the assignment part. I’ll spare the details but while working closely through screens and buttons we realise that assistant profile, in addition to what it already has, should also have have a last name. Turns out, while customers should only see first names, if we happen to have two Daves on the sales team, it will be hard to distinguish between them in case of reassigning (think of a drop down with only names vs drop down with "name surname").


Also, the email that gets automatically sent to a customer upon an assignment, should have a round image of Dave (according to designs) and that image could not be rounded with css since there ain't no fancy css (round corners that is) in emails. Therefore, we have to generate the round version when the profile image is uploaded.

All that means that assistant profiles created so far will have to be changed to add last name and the images will have to be reuploaded. And the next deploy to production is going to involve down time for db migration (we thought we were done with migrations in the first part).

Well, luckily, none of this is a big deal since no one from the sales team has actually bothered to create any assistant profiles yet.

Those issues are not massive, of course. But this simple example hopefully illustrates how, on a bigger scale, things can suddenly get out of sync when features, broken up into bits based on what developers think would be the best way to deliver them, do not quite match up when you put them back together in the end. This results in extra integration work  (by changing something that already is assumed to have been done) or, worse, accepting those inconsistencies for whatever reason, making business to get on with it and building up new features on top. To relate that last one back to our example, we could suggest to use email address in the “reassign assistant” drop down and that way we won’t have to introduce last name at all. It is less user friendly, but does not cost _anything_. Suddenly, something that we would not even consider in the beginning, becomes a viable option just on that basis.

Now. Let us see how we could have avoided those inconsistencies early at a low cost. Let us rewind back to the point where no code has been written yet and we were laying out the first integration test. Except this time let us call it an acceptance test. And what that implies is not just a change of a buzzword but a change of how we think about it. Let us not think about what links and buttons users are going to click, but, instead, let us focus on what motivates them to take the hustle of doing so. Here is our first scenario written this way:

{% highlight ruby %}
scenario "create assistant profile" do
  given_jessy_is_an_admin()
  and_walter_is_a_sales_person()
  when_jessy_wants_to_make_walter_an_assistant()
  then_he_can_do_so_from_an_admin_interface()
end
{% endhighlight %}

Wait, what? That makes no sense. Does Jessy create an assistant profile so that he can… create an assistant profile? Huh? This is clearly wrong. Let us think again. But no matter how hard we try, turns out, on its own, there is no better value in just creating assistant profiles. Which reveals the fact that there is _no_ value at all. And that is why sales haven't created any profiles yet. They are pragmatic and also busy. They’d only invest time in doing something if the return on that investment was worth it. (of course, in reality, there can be plenty of other reasons, but I am making a point here!)

So let us write something that adds value, shall we?

{% highlight ruby %}
scenario "customer contacts an assistant by replying to introduction email" do
  given_ned_just_requested_a_quote()
  and_he_realised_that_he_forgot_to_ask_about_finance()
  when_he_receives_an_email_introducing_an_assistant()
  then_he_can_reply_to_this_email_with_his_question()
end
{% endhighlight %}

There is also going to be a "customer contacts an assistant from a quote page" scenario. And a scenario for every other way for a customer to exercise "contact assistant" _feature_. But let us just focus on this one. 

Notice how it assumes that "assistant profile" is already an existing thing. By the time we’re done implementing this scenario (and its siblings), there will still be no user interface for creating those. There will, however, be an obvious need to create them. Since, otherwise, none of the above will produce any value. This is a good old "outside in" only this time applied on a higher level where no code, but the features themselves are being designed.

So, perhaps, now it would be the right time to do the CRUD bit? It certainly is a better time, but let us keep exploring what "assistant" is without diving into admin interfaces just yet. Why? Because that admin ui is the direct reflection of our _current_ knowledge of what "assistant" is. When the knowledge changes, the code will have to be changed too. Best wait until our knowledge is complete.

And there happens to be one more feature in the pile that is not about managing profiles - "reassign assistant":

{% highlight ruby %}
scenario 'admin reassigns assistant' do
  given_tweedy_has_requested_a_quote()
  and_rocky_has_been_assigned_to_assist()
  when_he_gets_hit_by_a_bus()
  then_an_admin_can_reassign_ginger_to_be_tweedies_assistant()
end
{% endhighlight %}

While implementing the reassign drop down, we realise that an assistant also requires a last name. Good thing we didn’t rush with the admin ui. We’d have to go back and add it everywhere.

Ok, now can we do the CRUD? Yes. But it is no longer just about the CRUD. As we’ve already established, there isn’t much value in it on its own. But what is that value then? There is one last piece of functionality left unspecified: initial assistant assignment. Remember that "you can’t assign anything if it does not exist yet" argument? Well now it is the right time to pull it out. So let us connect the two and complete the puzzle:

{% highlight ruby %}
scenario "admin creates an assistant" do
  given_marty_is_a_sales_person()
  and_rust_is_an_admin()
  when_he_creates_an_assistant_profile_for_marty()
  and_then_customer_reggie_requests_a_quote()
  then_marty_becomes_reggies_assistant()
end
{% endhighlight %}

And… cut!

There are tools that support the this style of testing. Most notably, Cucumber (using Gherkin syntax). A lot of people don’t like Cucumber and they have good reasons for it. Still, in my opinion, it is well worth it.

But this is not why I am mentioning it. One part of Gherkin is a feature narrative. It is a blob of text at the very top that is not mapped to any executable code. For that reason, it is often skipped because it is just words. But if you’re sold on that value thing I am talking about, that would be the starting point of exploring it. The starting point here is to understand why the business needs the feature, before getting into the details of individual scenarios. In the hunt for value, this will set you on the right track. And it is still "outside in" by the way, only at the even higher level. Back to our example we could write something like:

*In order to reduce the drop out of potential customers,<br>
we’d like to make their experience more personal and engaging by assigning an "assistant" to each quote request.<br>
Assistants will follow up on quotes and will be there to answer any questions.*

So, yeah, The Value. It is an incredibly important thing to question. The earlier the better. Doing so costs little compared to what it can save. And going back to our tests, it is kind of hidden when the test is written as a sequence of actions, but a lot more obvious when it is written in terms of what users are trying to achieve and why.
