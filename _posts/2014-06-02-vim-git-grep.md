---
layout: post
title: "Git a Grep on Vim"
description: ""
category: 
tags:
  - vim
---
{% include JB/setup %}

I've been a happy user of [ag.vim][1] for years until recently I started to work on a phonegap project. Two things are special about it:

- ./node_modules
- compiled source files

Both of these are included when grepping the project and, man, this is annoying. And slow.

So today I've had enough and decided to do something. Surprisingly, quick googling didn't reveal anything I could just copypaste somewhere, so I had to put on my bash pyjamas and sort this out like a pro.

I've heard of `git-grep` and the plan was to bolt it in instead of a stock `ag`, but only if current vim folder is a git project (or a subfolder of one). This way none of the aformentioned types of files will be included in the search.

So this is it. Two steps.

**First**. Save this code to `agprg.sh`:

{% highlight bash %}
#!/bin/sh
# this is used as vim grepprg in conjunctions with ag.vim

if [ -d .git ] || git rev-parse --git-dir > /dev/null 2>&1; then
  git grep -n $1 | while read git_grep; do

    file_and_line=$(echo "$git_grep" | cut -d: -f1,2)
    match=$(echo "$git_grep" | sed 's/[^:]*:[^:]*:\(.*\)/\1/')
    column=$(echo "$match" | awk "{print index(\$0, \"$1\")}")

    echo "$file_and_line:$column:$match"
  done
else
  ag --column $1
fi
{% endhighlight %}

Make sure this is in the `$PATH` and don't forget to `chmod +x` it.

**Second**. Add this to `.vimrc`:

    let g:agprg = 'agprg.sh'

And voila, search. As in, The Search. Fast and furious.

<br>
<hr>
<br>

If you don't use `ag.vim` then you can still use this with `vimgrep`. Just add this (in addition to the above) to `.vimrc`:

    let g:grepformat="%f:%l:%c:%m"

[The silver searcherer](https://github.com/ggreer/the_silver_searcher) is still expected to be installed.

  [1]: https://github.com/rking/ag.vim
