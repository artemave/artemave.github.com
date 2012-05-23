---
layout: page
title: Artem Avetisyan
---
{% include JB/setup %}

{% assign post = site.posts.first %} 

<div class="page-header">
  <h1><a href="{{ post.url }}">{{ post.title }}</a></h1>
  {% if post.date %}
    <h6>{{ post.date | date_to_long_string }}</h6>
  {% endif %}
</div>
{{ post.content }}
