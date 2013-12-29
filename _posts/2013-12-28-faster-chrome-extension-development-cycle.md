---
layout: post
title: "Faster Chrome extension development cycle"
description: ""
category: 
tags: [chrome extensions]
---
{% include JB/setup %}

Here is how developing chrome extension works out of the box:

1. make a change
1. open "extensions" page
1. find your extension there
1. hit reload
1. test the change

<p></p>
Steps 2,3,4 really should not be there. Doing this over an over again just makes me want to stop writing software and get into baby clothes instead.

Turns out I am not the only one to feel that pain. There is an [Extenstion Reloader](https://chrome.google.com/webstore/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid) extension that, if combined with [Guard](https://github.com/guard/guard), automates those steps.

There is a bit of setup. But really is just a bit, assuming you've got a ruby interpreter and a terminal. It works on OSX and, with minor adjustments, on Linux. Not sure about Windows.

Install `guard-shell` gem:

    $ gem install guard-shell

Add `Guardfile` to the root of your project with the following contents:

{% highlight ruby %}
guard :shell do
  watch /(js|css|html|json)$/ do
    `open -g http://reload.extensions`
  end
end
{% endhighlight %}

In a terminal, cd into project folder and run `guard`.

That is it. From now on, while guard is running, changing any file inside your project will result into extensions reload in a background.

</br>

One caveat though, looks like Extension Reloader does not reload changes in manifest. Other than that, you got it!
