---
layout: post
title: "Better Shopify app integration testing"
description: ""
category: 
tags: []
---
{% include JB/setup %}

Part of the system I am currently working on is to act as Shopify application. That is to be able to interact with its API. 

I have an integration test (cucumber/capybara) that uses real Shopify retailer site, however, that approach has its obvious drawbacks: such tests are slower and they fail every now and then because of network issues. It is a good start while working on a feature, but it is just not good enough to have it in a an everyday test suite. 

On the other hand, a test that uses real site is closer to reality. So, ideally, I want to keep both options, but only run the latter one occasionally to check higher lever integration.

My test scenario consists of three steps: application installation, buying something on retailer site and querying api for order details. 

Below I am going to cover how to make all three not depend on actual shopify site, but still be able to dynamically switch back to that path.

## install application

Shopify is using `OAuth2` to authenticate and grant permissions to the application (that is, install). If your app is a rails one, then you must be using [shopify_api](https://github.com/Shopify/shopify_api) gem which in turn is using [omniauth-shopify-oauth2](https://github.com/Shopify/omniauth-shopify-oauth2) under the hood. But you probably know that anyway. 

Lesser known that [omniauth](https://github.com/intridea/omniauth) has a pretty elegant [solution](https://github.com/intridea/omniauth/wiki/Integration-Testing) for integration testing. All you have to do is to stick the following somewhere in `env.rb`:

{% highlight ruby %}
OmniAuth.config.test_mode = true
OmniAuth.config.add_mock :shopify, {
  provider: 'shopify',
  credentials: {
    token: 'test_token_blah'
  }
}
{% endhighlight %}

From their docs: 

> _Once you have enabled test mode, all requests to OmniAuth will be short circuited to use the mock authentication hash as described below. A request to `/auth/provider` will redirect immediately to `/auth/provider/callback`_

So now in the step definition we need to distinguish between authenticating locally or against real shopify. Assuming there is link to install app on a current page, here is helper that does the job:

{% highlight ruby %}
def install_app
  click_link 'install app'

  if not $http_stubbed # then 'install app' link will bring us to real shopify site admin area
    fill_in 'Email Address', with: 'real_admin_user@example.com'
    fill_in 'Password', with: 'real_password'
    click_button 'Sign In'
    click_button 'Install'
  end
end
{% endhighlight %}

`$http_stubbed` is set via passing an environment variable when running cucumber:

{% highlight ruby %}
# env.rb
$http_stubbed = ENV['UNSTUB_HTTP'] != 'true'
{% endhighlight %}

&nbsp;  

##  buying a product

In my application, when user buys something on shopify store, some custom javascript (added to shopify success page) calls back home to trigger order processing. The system does not care if it is a real shopify success page. So all we need is a page that, when visited, runs that script. Having done that, let us introduce a helper that will conditionally buy either real product or a fake local one:

{% highlight ruby %}
def buy_banana
  if $http_stubbed
    # test route that leads to our fake success page
    visit '/test_retailer/banana_success'
  else
    visit 'http://real-store.myshopify.com/products/banana'    
    add_current_product_to_cart
    purchase_contents_of_cart
  end
end
{% endhighlight %}

&nbsp;  
## querying Shopify API for order details

Once the order is purchased, our system goes away and queries the Shopify API to get order details and do some mumbo jumbo with it. Since the goal is to replace real Shopify, we need to stub out those interactions, but in such way that our system never notices the difference.

Common approach to stub HTTP interactions is to use [VCR](https://github.com/myronmarston/vcr) gem. It records low level HTTP interactions, stores them in files and allows to replay them later in tests.

On the surface that seems strait forward, but doing it right™ ended up being the most confusing and difficult part of the whole setup. Let us cover things I had troubles with bit by bit.

### ignore unwanted requests

Once in playback mode, VCR will blow up on any request it does not know about. This is totally sensible, but may (and will) cause confusion at first. Good news is that VCR can be configured to ignore certain requests. Here is an example from my setup:

{% highlight ruby %}
VCR.configure do |c|
  ...
  c.ignore_localhost = true
  c.ignore_request do |request|
    uri = URI(request.uri)
    # this is just an example obviously
    uri.host =~ /(?<!vasily-on-shopify.)localtest\.me|www.google-analytics.com/
  end
  ...
{% endhighlight %}

&nbsp;  
### binary headers

By default, all headers in VCR fixtures (this is only in case of Shopify though) will be in binary representation. That is not always handy, especially if you need to dynamically change some values in there. This problem is described in more details [here](https://groups.google.com/forum/?fromgroups=#!topic/vcr-ruby/2sKrJa86ktU). And here is the workaround:

{% highlight ruby %}
VCR.configure do |c|
  ...
  c.default_cassette_options = {
    ...
    serialize_with: :syck, # so that headers are human readable
    ...
  }
  ...
{% endhighlight %}

&nbsp;  
### binary response body

The above trick does not solve another binary related problem: response body. That is because it is genuine binary data and it took me quite a while to figure out exactly what the heck this binary represents. Turns out the response content is gzipped. 

Why is this a problem? It becomes one the second you need to dynamically modify response data. In my case, order created timestamp has to be changed so that order passes some validation inside my app. It is easy to find created_at in human readable response json and change its value to `<%= Time.now %>`. The same is obviously impossible with binary data.

So here how I deal with this:

{% highlight ruby %}
VCR.configure do |c|
  ...
  c.before_record do |interaction|
    require 'zlib'
    require 'stringio'

    if interaction.request.headers['user-agent'].first =~ /ShopifyAPI/
      content_encoding_header = interaction.response.headers['content-encoding'].first
      content                 = interaction.response.body

      interaction.response.body = if content_encoding_header == 'gzip'
                                    interaction.response.headers.delete 'content-encoding'
                                    Zlib::GzipReader.new(StringIO.new(content)).read
                                  else
                                    content
                                  end
    end
  end
  ...
{% endhighlight %}

The above code unzips content before cassette is recorded.

### rerecord cassettes

I want to be able to rerecord cassettes every now and then to keep up with the reality. One problem here is that it erases all manual modifications made to VCR fixtures (e.g, created_at ERBfication).

The solution here is to employ `c.before_record` hook more heavily. It might end up in more code, you're going to need to parse json, change it and serialize back, but the result is worth it. Here an example:

{% highlight ruby %}
VCR.configure do |c|
  ...
  c.before_record do |interaction|
    # change created_at to Time.now so it passes timebox check
    if interaction.request['uri'] =~ /orders.*\.json/
      order = JSON.parse(interaction.response.body)
      if order['order'] # means if not 401
        order['order']['created_at'] = '<%= Time.now %>'
        interaction.response.body = JSON.dump(order)
      end
    end
  end
  ...
{% endhighlight %}

Also, when rerecording, do not use VCR record mode `:all` as it only overwrites the same requests and adds new ones, but does not wipe out the old unmatched ones. Simply remove fixture file instead.

***********

And that is about it! Simple, isn't it? But jokes apart, I believe fiddling with tests at such level is an investment in understanding your system better which in turn allows to find bugs earlier and fix them while in comfort zone (that is, while the context is in your head and the code is not in production) 
