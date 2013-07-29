---
layout: post
title: "CIborg anywhere (not just on ec2)"
description: ""
category: 
tags:
  - testing
  - ci
---
{% include JB/setup %}

[ciborg](https://github.com/pivotal/ciborg) lets you easily create CI instances on Amazon ec2. It is truly amazing in the sense that it just works. Having recently been stubbed multiple times to death with [knife](http://docs.opscode.com/chef/knife.html) by [chef](http://www.opscode.com/chef/), I am very grateful that tools like ciborg do exist. 

The only downside is that it is coupled to ec2 and ec2 only. Hopefully folks at pivotal labs will sort this out at some point, but as of this writing, that is the reality of it. So whether you want to explore other (cheaper) options such as [digitalocean](https://www.digitalocean.com/) you are out of luck.

I've been looking into ciborg source code thinking I could cannibalise bits that are only specifically about provisioning and configuration, rather than creating/destroying instances. I got deep down that rabbit hole before I finally discovered that there is no need to do that at all. The ciborg commands responsible for this (`bootstrap` and `chef`) already are operating on the basis that there is a server somewhere and that its address is explicitly set in the config. In my case, all I had to do was to create a droplet on digitalocean and put its ip in `ciborg.yml`

There a few things however that ciborg assumes about an instance:

- it is ubuntu 12.04
- it has `ubuntu` user account with sudo rights (NOPASSWD)
- `ubuntu` user can ssh without password (hint: `ssh-copy-id ubuntu@your-ci-host`)

After making sure my newly created droplet satisfied those conditions, I ran `ciborg bootstrap` followed by `ciborg chef` and watched the magic going. For a long while. Once that had finished, `ciborg open` popped up a browser with jenkins already running my first build!

In case of a small setup of only one ci instance I reckon losing the ability to automatically create/destroy instances is not a big deal. What is left, on the other hand, is:

- jenkins behind nginx secure proxy
- jenkins that can pull from your github private repos
- bootstrapped ci environment suitable out the box for simple stuff like rails
- the multitude of recipes from travis-ci cookbooks pluggable by simply adding them to `ciborg.yml`

Here is the `ciborg.yml` (that has gotten smaller as a result of all the this):

    ---
    ssh_port: 22
    master: 12.13.14.15
    recipes:
    - pivotal_ci::jenkins
    - pivotal_ci::limited_travis_ci_environment
    - pivotal_ci
    - mongodb::default # that is how easy to add recipe from travis-ci cookbooks!
    cookbook_paths:
    - ./chef/cookbooks/
    - ./chef/travis-cookbooks/ci_environment
    - ./chef/project-cookbooks
    node_attributes:
      travis_build_environment:
        user: jenkins
        group: nogroup
        home: /var/lib/jenkins
      nginx:
        basic_auth_user: login
        basic_auth_password: password
      jenkins:
        builds:
        - name: master
          repository: git@github.com:shopa/shopa.git
          branch: master
          command: script/ci_build.sh


**TL;DR;** Use ciborg! Now anywhere!


