---
layout: post
title: "Developing in Linux on OSX"
description: "How to set up Linux server in VirtualBox on OSX. With clipboard integration for vim/xclip."
category: tools
tags:
  - tools
  - vim
  - VirtualBox
---
{% include JB/setup %}

I wanted to move to Linux development environment, but at the same time I wanted to stay on OSX for everything else. So VirtualBox was the obvious option. I also had few extra requirements:

- lots disk space
- integration with OSX clipboard (so that vim/xclip work transparently)
- static IP (for hosts file, nginx conf and general convenience of never having to look up new IP address)

If you happen to need something similar, then simply follow TLDR; below.

##TLDR;

- Install [Packer](https://www.packer.io/docs/installation.html), [VirtualBox](https://www.virtualbox.org/wiki/Downloads), [Vagrant](https://docs.vagrantup.com/v1/installation/)
- `git clone https://github.com/artemave/vagrant-boxes.git && cd vagrant-boxes`
- `cd packer && packer build --only=virtualbox-iso -var 'DISK_SIZE=102400' ubuntu-15.04-server-amd64.json; cd ..` (disk size is in megabytes)
- `vagrant box add ./builds/virtualbox/ubuntu-15.04-server-amd64_virtualbox.box`
- `vagrant up`

By default VM is set to have 6GB of ram. You can adjust this in `Vagrantfile`.

To get host/guest clipboard integration, install [XQuartz](http://xquartz.macosforge.org/landing/), set the pasteboard settings to look like this:

<img src="{{ site.url }}/assets/pasteboard.png" style="width: 100%;"/>

and make sure XQuartz is running whenever you `vagrant ssh`.

You can also build a VMware box (`--only=vmware-iso`), but I haven't tried it.

## Notes (for the curious)

When I say "development environment" what that really means is console development environment. I use [tmux](https://tmux.github.io/) for keeping sessions/windows per project, Vim as an editor and command line for everything else.

This kind of setup is perfectly achievable in OSX of course. The main reason to move to Linux was the lack of native docker support for OSX. "But there is [docker-machine](https://docs.docker.com/installation/mac/) (former boot2docker)" I can hear you saying. And that is true. But there is also a range of minor issues (such as no support for host data volumes, or slow VirtualBox file sharing for when you want to develop against running container, or some more obscure ones) that come with it. It is just one more abstraction layer that will always get its toll.

There are other good reasons to use Linux, but, perhaps, it was just that time of the year when one needs to shave a yak, so I thought why not, let us give it a go.

By the way, nice thing about having all work stuff in a VM is that when you need to restart your laptop, it only takes `vagrant suspend` to pause the VM and `vagrant up` after restart to pick things up right where you left them. Also setting up new machine is much faster.

Initially I wanted full GUI experience (with [i3wm](https://i3wm.org/) tiling window manager), but the graphics turned out to be far too slow. A bit disappointing, giving the top dog MacBookPro.

Then I decided to use Vagrant with a server box. However stock boxes are set to have 40GB disk and, as I quickly learned, resizing VB disk images involves more steps than a human can follow.

So I ended up forking the [base boxes repository](https://github.com/ffuenf/vagrant-boxes), changing the disk size in packer config and building the box myself.

To keep things simple I also dropped the `Vagrantfile` into the root of my fork. There are three things to note there:

- static IP: `config.vm.network "private_network", ip: "192.168.33.10"`
- ssh with X11 forwarding (for clipboard integration): `config.ssh.forward_x11 = true`
- provision script: installs few useful packages (opinionated) and, most importantly, compiles Vim with X support (for clipboard integration) along with some other batteries (such as Lua support for [Unite.vim](https://github.com/Shougo/unite.vim)).
