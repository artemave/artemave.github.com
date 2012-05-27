---
layout: post
title: "Stub like a surgeon, spy like James Bond with REST-assured"
description: ""
category: 
tags: [testing REST]
---
{% include JB/setup %}

This is the story of [REST-assured](https://github.com/BBC/REST-assured), a testing tool for isolating automated integration tests from external HTTP-based dependencies. Unlike alternatives that I know of (most notably [VCR](https://github.com/myronmarston/vcr)), it does not stub out the underlying HTTP client library, but rather is an actual service that is configurable to respond in arbitrary ways. As an immediate result it is language agnostic, supports spying and... Let me tell you the whole story first.

I work in BBC Future Media. The problem of testing systems talking to each other via HTTP is extremely relevant here. There are a countless number of services that provide more or less RESTful APIs and in turn consume from others. None of the products (that I know of) are standalone.

When it comes to integration testing (in a particular project) we are forced to think hard how to represent those dependencies to our application. It would be nice of course to simply spin up a virtual machine with the services needed next to our code, but that sadly is rarely an option, not the least because some of those services are in development themselves.

Lots of tools adressing this problem arose in such a highly 'fertilized' environment. Some are hidden in corporate SVN repos, and some have seen the light of day ([rack-stubs](https://github.com/featurist/rack-stubs), [anmo](https://github.com/AndrewVos/anmo)). REST-assured is one of a kind that eventually grew into something more generic and hopefully can be helpful out there in the wild.

When I first faced this problem, I thought for a bit and started using hand-crafted fixtures which were served directly from tests. As the number of tests grew, the focus shifted from creating new fixtures towards reusing existing ones. Further down the line, making them configurable started to sound like a good idea. Then one day it became apparent that it is quite hard to figure out their state during non-trivial tests. And so it went on and on, presenting new challenges.

And it was for that reason (not because programmers love to create frameworks!), it didn't take too long till I found myself pulling all that stuff out into a framework. Well, OK, not a framework strictly speaking, but something along those lines.

My current project here is a 'control panel' type of thing that sits between multiple external systems, presents their data in the browser, issues control requests to some of them based on user actions, delivers responses back to the user and updates the state of things in others.

We keep development within the BDD cycle. Every feature starts with automated acceptance test. For this we are using [Cucumber](http://cukes.info/) with ruby. Once we get the meaningful failure out it, we go down to Javascript unit tests (using [Jasmine](http://pivotal.github.com/jasmine/)) and when those pass, end up on Java layer where JUnit and [Mockito](http://code.google.com/p/mockito/) help us to test drive the back-end.

On a side note. Nowadays there is a nice alternative for Java projects - [cucumber-jvm](https://github.com/cucumber/cucumber-jvm) - so that everything can be kept within the same project, language, libraries, etc. It looks very impressive, but on the other hand I kind of appreciate the fact that there is a ten foot wall between production code and integration tests. We are forced to treat the system as a black box.

With a few exceptions, every scenario in our suite has a `Given` step that implies data lookup in external systems. And many of our `Then` steps verify that certain requests have happened in a particular manner. So being able to stub/spy on HTTP interactions becomes a prerequisite to being able to test anything at all.

Below I am going to cover few typical scenarios and how REST-assured comes at rescue. There will be ruby code (just because there is ruby client library), but it isn't limited to ruby and can be controlled from within any environment capable of making http requests (e.g, curl will do). Or even through web interface.

Let us summon an imaginary client who wants an application that shows most popular tweets for a search criteria. He anticipates that users aren't generally strong on command line and also won't be bothered installing a native client. So he wants a webapp. All right. We unfold our cucumber communicator and agree to start with the following simplest feature:

{% highlight ruby %}
Given there are no popular tweets about "X"
When I search for popular tweets about "X"
Then I should see that there are no popular tweets about "X"
{% endhighlight %}

I am not going to go into details of setting up a [Sinatra](http://www.sinatrarb.com/) and Cucumber project (check out the demo project [here](https://github.com/artemave/REST-assured-example)). Except for one thing which is relevant to what we are talking about. To be able to stub Twitter’s search API, let us inject its host as a dependency (so to speak):

{% highlight ruby %}
# tweet_checker.rb
TWITTER_HOST = ENV['TWITTER_HOST'] || 'http://search.twitter.com'
{% endhighlight %}

and configure it to point to the REST-assured instance in tests before loading application code:

{% highlight ruby %}
# env.rb
ENV['TWITTER_HOST'] ||= 'http://localhost:4578'
require_relative '../../tweet_checker'
{% endhighlight %}

Now let us find out what real Twitter returns when nothing is found:

{% highlight bash %}
% curl 'http://search.twitter.com/search.json?q=asdfsdfrefsdfsdgs&result_type=popular'
{"completed_in":0.0070,"max_id":0,"max_id_str":"0","page":1,"query":"asdfsdfrefsdfsdgs",
"results":[],"results_per_page":15,"since_id":0,"since_id_str":"0"}
{% endhighlight %}

And use the result to craft response in the Given step:

{% highlight ruby %}
Given /^there are no popular tweets about "([^"])*"$/ do |query|
  RestAssured::Double.create
    fullpath: "/search.json?q=#{query}&result_type=popular",
    content: %({"completed_in":0.0070,"max_id":0,"max_id_str":"0","page":1,"query":"#{query}",
      "results":[],"results_per_page":15,"since_id":0,"since_id_str":"0"})
end
{% endhighlight %}

The above means that a GET request to _http://localhost:4578/search.json?q=X&result_type=popular_ will return the JSON for an empty result set. And when our app (driven from `When` step) hits this url, it will appear to it as if there are no tweets. So that `Then` step can observe the result page and check for the expected message about no popular tweets.

Next, we want to tackle the case where twitter returns something. Here goes the second feature:

{% highlight ruby %}
Given the following tweets are most popular mentioning "Y":
  | from_user | text                                 |
  | bob       | check it out, my tweet gets recuked! |
  | alice     | Yo dog, your cuke makes me puke      |
When I search for popular tweets mentioning "Y"
Then I should see those tweets
{% endhighlight %}

To be fair, the above scenario should not expose any test data. But since I want to demonstrate usage of more complex fixtures and I couldn't think of a better example, we'll stick to this one.

So, again, we take a sample of a real response - only this time, since it is quite a big chunk of JSON, let us put it in a separate file. We also want to substitute bits of it with test data, so let us make an ERB template out of it.

{% highlight erb %}
{
  "results": [
    <% tweets.each do |t| %>
    {
      "profile_image_url": "http:\/\twimg.com\/profile_images\/u.jpg",
      "from_user_id_str": "149752077",
      "created_at":"Sat, 05 May 2012 21:37:12 +0000",
      "id_str": "116001342874595328",
      "from_user": "<%= t[:from_user] %>",
      "to_user_id": null,
      "text": "<%= t[:text] %>",
      "metadata": {
      ...
{% endhighlight %}
 
&nbsp;

{% highlight ruby %}
Given /^the following tweets are most popular mentioning "([^""]*)":$/ do |query, table|
  @expected_tweets = table.hashes.clone
  template = File.read(File.expand_path('../tweets.json.erb', __FILE__))
  tweets_json = Erubis::Eruby.new(template).result(tweets: @expected_tweets)

  RestAssured::Double.create
    fullpath: "/search.json?q=#{query}&result_type=popular",
    content: tweets_json
end
{% endhighlight %}

The verification step is going collect tweets shown on a page and compare them with those saved in `@expected_tweets`:

&nbsp;

{% highlight ruby %}
Then /^I should see those tweets$/ do
  actual_tweets = all('#tweets tbody tr').map do |row|
    { 'from_user' => row.find('.from_user').text, 'text' => row.find('.text').text }
  end
  actual_tweets.should =~ @expected_tweets
end
{% endhighlight %}

It is worth mentioning that our Given step is already a bit too complicated for a step definition. All the template mangling and creation of a double should be hidden in a domain object. Something like, `PopularTweetsSearchResult.new(tweets: @expected_tweets)`. And with time, as the number of constructor options grows, that domain object creation can in turn be delegated to [Factory Girl](https://github.com/thoughtbot/factory_girl) (or the like). This might sound like overkill, but the truth is that Cucumber is not particularly great at organising steps, so passing state around in conjunction with step reusability pushes complexity through the roof before you know it. So, ruthlessly moving whatever you can away from that context is not a bad idea.

Ok. The project goes on and the day comes when our client shows their true face as the following feature lands on our table:

{% highlight ruby %}
Given there are popular tweets about "Z"
When I search for popular tweets about "Z"
Then the record should be sent to The Vegan Police Intelligence Service
{% endhighlight %}


&nbsp;

![vegan police](http://images.wikia.com/scottpilgrim/images/4/47/Vegan_Police_Movie.jpg)

&nbsp;

Well, money has no smell. Besides, we already switched to use Factory Girl, so there is no turning back anyway.

{% highlight ruby %}
Given /^there are popular tweets about "([^"]*)"$/ do |query|
  # factory takes care of creating double with sensible default tweets
  @search = build(:popular_tweets_search_result, query: query)

  @create_record_double = RestAssured::Double.create 
  fullpath: "/api/tweet_search_records",
    verb: 'POST',
    status: 201
end
{% endhighlight %}

`@create_record_double` is going to match any POST to _http://localhost:4578/api/tweet\_search\_records_. It is not going to return any content, just an HTTP 201 repsonse. Ideally it should also be hidden inside its own domain object, but for demonstration purposes let us leave it as is. Much like the Twitter search API, The Vegan Police Intelligence Service host address also needs to be changed to point to the REST-assured instance.

Our `Then` step is going to analyse what requests have hit `@create_record_double` (if any) and verify that they match our expectations.

&nbsp;

{% highlight ruby %}
Then /^the record should be sent to The Vegan Police Intelligence Service$/ do
  @create_record_double.wait_for_requests(1) # will raise exception if that does not happen
  req = @create_record_double.requests.first

  # verify that payload contains search query and user
  req.body.should =~ @search.query
  req.body.should =~ @search.from_user
end
{% endhighlight %}

The above looks a bit messy. [Rspec custom matchers](https://github.com/dchelimsky/rspec/wiki/Custom-Matchers) help a great deal with tidying up complex verifications such as this one. I am not going to go into the details of defining one, but in the end  it should look like the following:

{% highlight ruby %}
Then /^the record should be sent to The Vegan Police Intelligence Service$/ do
  @create_record_double.should have_been_requested
    .with_query(@search.query)
    .with_user(@search.from_user)
end
{% endhighlight %}

Years have passed since we commissioned our little project. The silver has been spent big time. And millions of people have been brainwashed to absolutely love it. But one day we got an email from a beloved customer to investigate an issue. The problem seems to be that no records are being posted to The Vegan Police Intelligence Service any more.

Say no more. We immediately check the CI build status and observe that everything is happily passing. Meaning that, as far as our tests are concerned, records are being sent. After hours of collective head scratching, we finally go back and read the rest of their [smug report](http://soreeyes.org/archive/2012/03/05/beware-the-hindenbug/) where they suggest, amongst other obviously irrelevant things, that it could be due to recent API changes. Blimey! Turns out the new version changed the records API. The easiest fix in our case would be to stick `/v1` in the POST URL in order to use the old version. OK. First we change our test double and make sure of the correct failure, then change the implementation. And looks like we are done, right? Not quite so. The bug is fixed but the underlying problem is not. Fixtures will still eventually go out of date. We need a way to validate our assumptions (that is what fixtures are) against something more real.

Unfortunately, it is difficult to address this problem in general (we tried), as the definition of valid is very much context dependant. So even though REST-assured creates this problem, it doesn't provide any built-in solutions (so typical!) and your tests are probably the best place to host such checks. Nonetheless, forewarned is forearmed and hopefully this is not going to ruin your day. One piece of advice here: consider using tools like VCR to cache HTTP interactions or else things will get REALLY slow.

Speaking of slow, REST-assured adds quite a bit of an overhead to test startup, as it spins up a separate service stuffed with ActiveRecord, ActiveResource and some other things you don't want to know about. Two options here: consider using [spork](https://github.com/sporkrb/spork) or start it separately from tests. Both options work great in development (e.g. when you want lots of re-runs) and also give you the benefit of being able to inspect doubles via a web interface after the tests have finished.

Wrap up time. Let us recap what REST-assured is and what it is useful for. REST-assured is a locally deployable service that you can configure at runtime to respond to arbitrary HTTP requests. As such, it can be used to serve test fixtures to an application under test. It also records all requests made to it, so that more control-type requests can also be verified.

So that is it for the introduction of REST-assured. You can give it a try [right here](http://rest-assured.herokuapp.com/) right now. Have a nice day. And don’t let them catch you.
