---
layout: post
title: "Ajax in Rails how it is meant to be"
description: ""
category: 
tags:
  - Rails
---

{% include JB/setup %}

_If you can use [turbolinks](https://github.com/rails/turbolinks) in your project, use it and read no further._

Like so many others, the website I am currently working on is using client side js and ajax to make user experience snappier by not reloading page when they click links and buttons. But, ultimately, every user action results in a server call. No state is client side only.

To do this, we intercept form submissions and link clicks in js, turn them into `$.ajax` and handle the json or html returned from the server in success handler. Pretty standard. And pretty repetitive too. Why so? Because every time code follows the same pattern of intercepting the user event, rebinding to `$.ajax` and handing the response. Over and over again.

Rails is good in shortcutting common tasks away. And this case is no exception. Below I'll demonstrate what rails has to offer using a simplified example of posting a comment into the comments thread ([source code](https://github.com/artemave/railjax-demo))

Let us start with a non-ajax version ([commit](https://github.com/artemave/railjax-demo/commit/7df1ee54c558fc6d051cba611832c64fd224d7de)):

**controllers/comments_controller.rb**:

{% highlight ruby %}
def index
  @comments = Comment.all
end

def create
  Comment.create! comment_params
  redirect_to action: :index
end
{% endhighlight %}

**views/comments/index.html.erb**:

{% highlight erb %}
<%= form_for Comment.new do |f| %>
  <%= f.text_area :text %>
  <%= f.submit %>
<% end %>

<%= render @comments %>
{% endhighlight %}

**views/comments/_comment.html.erb**:

{% highlight erb %}
<div class="comment">
  <span><%= comment.text %></span>
  <span><%= comment.created_at %></span>
</div>
{% endhighlight %}

Now let us ajaxify adding new comment.

## Json way

Intercept form submission and turn it into an ajax call that returns json ([commit](https://github.com/artemave/railjax-demo/commit/84b7fd1bee5f7c20e443eb0a59b6b8dd01ca9b43)):

**comments/comments_controller.rb**:

{% highlight ruby %}
def create
  comment = Comment.create! comment_params

  respond_to do |format|
    format.html { redirect_to action: :index  }
    format.json { render json: comment }
  end
end
{% endhighlight %}

**assets/javascripts/comments.js.coffee**:

{% highlight coffeescript %}
$(document).on "submit", "#new_comment", (e) ->
  e.preventDefault()
  $form = $ this

  $.post "#{$form.attr 'action'}.json", $form.serializeArray(), (comment) ->
    $text = $('<span>').text comment.text
    $createdAt = $('<span>').text comment.created_at
    $newComment = $('<div class="comment">').append($text).append $createdAt
    $('.comment:last').after $newComment
{% endhighlight %}

This might not be the best way of client side rendering, but it immediately highlights the problem of duplicate rendering of the same thing - comment - on the client and on the server. So, instead of returning json, let us reuse server side template and return html instead.

## HTML way

[commit](https://github.com/artemave/railjax-demo/commit/dcc848f2b1294cc978a78b08dd901e3d617a2c65)

**controllers/comments_controller.rb**:

{% highlight ruby %}
def create
  comment = Comment.create! comment_params

  if request.xhr?
    render comment
  else
    redirect_to action: :index
  end
end
{% endhighlight %}

**assets/javascripts/comments.js.coffee**:

{% highlight coffeescript %}
$(document).on "submit", "#new_comment", (e) ->
  e.preventDefault()
  $form = $ this

  $.post $form.attr('action'), $form.serializeArray(), (html) ->
    $('.comment:last').after html
{% endhighlight %}

That is where we normally stop. Our client side javascript is largely a combination of the two approaches above: json and html. But there is a third one where rails returns javascript that automatically gets evaled (by jquery-ujs) on successful response. Sounds evil. But let us see it in action.

## Javascript way

[commit](https://github.com/artemave/railjax-demo/commit/2d06091a06850ba997d6bbcd4ad58fbd4bb5bbb2)

**controllers/comments_controller.rb**:

{% highlight ruby %}
def create
  @comment = Comment.create! comment_params

  respond_to do |format|
    format.html { redirect_to action: :index }
    format.js
  end
end
{% endhighlight %}

**views/comments/create.js.coffee**

{% highlight coffeescript %}
$('.comment:last').after '<%= j render @comment %>'
{% endhighlight %}

We also need to add `remote: true` to `form_for` in comments index.

## So?

So why is this better than returning html?

1. Less code. More specifically, less glue code. Glue code is repetitive and boring. Good riddance.
2. No reference to the dom selector (of the comments form). Therefor, less coupling to maintain. Plus you don't have to make up names. Because _naming things is hard_.
3. Better code location. In json/html example the js code can be anywhere. Which means, harder to find. Whereas js template can only be in one place (its controller view path - `views/comments`) and named after the action - `create.js.coffee`.
4. Less client/server side code distinction. Apart from returning javascript instead of html, js template is no different from html one. The same erb and rails helpers are available there. This might be a subtle thing but it makes the development experience a bit less complicated.
5. No need to pass server side data to client js. That is where we normally start abusing html5 data attributes or simply store server side data (e.g. path helper values) in javascript variables on page load so it can be later accessed from javascript. Another bowl of glue.

## But what about "loading..."?

Sometimes you need to run javascript before the ajax request is sent. Typical example would be to disable user control (link or button) while request is going on and maybe show a loading spinner or something. Rails provides a simple shortcut for disabling controls: remote buttons and links accept `disable_with` option that will disable a control while request is in progress optionally changing its text.

Also, jquery-ujs broadcasts a [number of events](https://github.com/rails/jquery-ujs/wiki/ajax#custom-events-fired-during-data-remote-requests) which can be used to trigger global loading indicator or something along those lines. 

Obviously they can also be bound to specific links, forms and buttons but that is where it stops being pretty :)
