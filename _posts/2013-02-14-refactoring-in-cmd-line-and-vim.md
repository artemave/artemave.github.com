---
layout: post
title: "Refactoring in command line and vim"
description: ""
category: 
tags: [vim refactoring]
---
{% include JB/setup %}

Refactoring in dynamic languages may seem like a hassle. And it is! There is no IDE to perform the renaming magic, it is all a bit manual, hence error prone and scary. The good news is, the command line almighty is on your side. The not so good news is, its capabilities are so vast that it is often difficult to remember how to do X, Y and Z required to solve a particular problem. 

I am working on a rails project at the moment. Every now and then there is a 'domain object' (model, controller, views, tests, etc.) that needs to be renamed. It is a good example of refactoring so I figured it deserves a little coverage.

So, to business. There is model called `OfflineDeal` that needs to be turned into `InstoreDeal`.

## renaming files

Let us find all the files with `offline_deal` in their name:

    % find . -name "*offline_deal*" 
    ./app/assets/stylesheets/retailer/offline_deals.css.less
    ./app/controllers/offline_deals_controller.rb
    ./app/models/offline_deal.rb
    ./app/views/offline_deals
    ./db/migrate/20130117121729_create_retailer_offline_deals.rb
    ./db/migrate/20130118164309_change_vouchers_deal_id_to_offline_deal_id.rb
    ./db/migrate/20130121150012_add_referrer_reward_to_offline_deals.rb
    ./db/migrate/20130130172326_add_fine_print_to_offline_deals.rb
    ./db/migrate/20130131122749_rename_offline_deals_description_to_voucher_text.rb
    ./spec/controllers/offline_deals_controller_spec.rb
    ./spec/factories/offline_deals.rb
    ./spec/models/offline_deal_spec.rb
    ./spec/routing/offline_deals_routing_spec.rb

And pipe the result of find command into vim:

    % find . -name "*offline_deal*" | vim -

Notice that not all of these files require renaming. Migration files reflect change history and should therefor stay untouched. Let us get rid of the lines with those file names:

    :g/migrate/d

 and change the remaining ones into rename command:

    :%s/\(.*\)offline_deal\(.*\)/git mv & \1instore_deal\2

Each line is now turned into `git mv` command:

    ...
    git mv ./app/models/offline_deal.rb ./app/models/instore_deal.rb
    ...

And here is the magic part. Run them all:

    :w !sh

Voila, files are renamed.

## file changes

Inside project files there are 3 things to change: method references, symbol references and class name references.

The first two (including dynamic methods such as path helpers or AR finders) are covered with replacing all occurrences of `offline_deal` with `instore_deal`. Let us do it first.

Find all matching files and open them in vim:

    % vim $(ack offline_deal -l app lib spec features config)

I am using [ack](http://betterthangrep.com/) - a popular alternative to grep. `-l` option tells it to only print names of files with matches, not the matches themselves (as it does by default). That list of file names is passed to vim so they are all opened in buffers.

Now for each opened buffer let us perform the replace and save the changes:

    :bufdo %s/offline_deal/instore_deal/g | update

To rename class names, we repeat the above steps with `OfflineDeal` -> `InstoreDeal`.

## db changes (rails specific)

This part has got nothing to do with command line refactoring and it is only here for the sake of completeness.

We rename db table `offline_deals` to `instore_deals` in a migration. There are other tables referencing it, so corresponding foreign keys and index columns should also be changed.

## run tests

No tests? Time to panic!
