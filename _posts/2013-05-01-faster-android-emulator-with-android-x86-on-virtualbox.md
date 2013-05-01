---
layout: post
title: "Faster Android emulator with Android-x86 on VirtualBox"
description: ""
category: 
tags:
  - Android
---

A considerable amount of yak shaving, proportional to how big or new the next task is, normally accompanies my development activities. I am very new to Android development, so a lot of yak shaving has to happen before I start producing anything useful.

This post itself is yak shaving and as such makes a good example of meta yak shaving (it is, and describes yak shaving). The described yak shaving is about speeding up android emulator, as you might have already guessed.

So. The first thing on that quest is a low hanging fruit of [Virtual Machine Acceleration](http://developer.android.com/tools/devices/emulator.html#accel-vm). Sadly, it is low rewarding too. It barely promotes emulator from being a joke to "unbearably slow". Not good enough.

Next stop is more interesting - [Android-x86](http://www.android-x86.org/). It ports Android on x86 platform so it can be installed on a PC or, more specific to our needs, on a [VirtualBox](https://www.virtualbox.org/) VM. Let us go through the setup, as there are few hoops to be bear in mind.

**Create vm** with sensible defaults (Other Linux, 512 Mb RAM, HD 2 GB). Boot with [the ISO](http://www.android-x86.org/download) that you need.

**Setup port forwarding**:

    % VBoxManage modifyvm "VM_NAME_HERE" --natpf1 "console,tcp,,5554,,5554"    
    % VBoxManage modifyvm "VM_NAME_HERE" --natpf1 "adb,tcp,,5555,,5555"

so that `adb` (Android Debug Bridge) can connect to vm:

    % adb connect localhost
    connected to localhost:5555

At this point we've got a fully functional Android VM that we can deploy to from Eclipse. To do that simply use a run configuration with target set to "Always prompt to pick device".

**Fix resolution** because it is not mobile by default. Here is how to do it (mostly copied from [here](http://stackoverflow.com/questions/6202342/switch-android-x86-screen-resolution/8273560#8273560)):

1. Add custom screen resolution:

        % VBoxManage setextradata "VM_NAME_HERE" "CustomVideoMode1" "480x800x16"

2. Figure out what is the ‘hex’-value for your `VideoMode`:
    - Start the VM
    - In GRUB menu enter `a`
    - In the next screen append `vga=ask` and press Enter
    - Find your resolution and write down/remember the 'hex'-value for `Mode` column
3. Translate the value to decimal notation (for example `360` hex is `864` in decimal).
4. Go to `menu.lst` and modify it:  
    * From the GRUB menu select `Debug Mode`  
    * `vi /mnt/grub/menu.lst` to add `vga=864` (if your ‘hex’-value is 360) to the end of kernel boot parameters.
      Depending on what device you want to emulate (and probably current state of Android-x86 project) you might also want to change DPI (e.g. add/change `DPI=240`).
5. `reboot -f`

<br>
Finally, to enable **proper mouse support**, in VM settings (System tab) uncheck "Enable absolute pointing device".

<br>
That is it. Fast emulator, comparable to that of iOS. If only Google had something like that in their sdk. But hey, that would mean what, no yak shaving? Unacceptable.

{% include JB/setup %}
