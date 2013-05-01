---
layout: default
title: Artem's dev blog
---
{% include JB/setup %}
<div id="page">

  {% assign post = site.posts.first %}

  <h1><a href="{{ post.url }}">{{ post.title }}</a></h1>
  <div class="signature">
    <span class="date">{{ post.date | date_to_long_string }}</span>
    <div class="tags">
      <span class='label'>Tags:</span>
      <ul class="tag_box inline">
        {% assign tags_list = post.tags %}
        {% include JB/tags_list %}
      </ul>
    </div>
  </div>

  {{ post.content }}

  <div class="prev-next">
  {% if post.next %}
    <a href="{{ post.next.url }}" class="next" title="{{ post.next.title }}">Next Post &rarr;</a>
  {% endif %}
  {% if post.previous %}
    <a href="{{ post.previous.url }}" class="prev" title="{{ post.previous.title }}">&larr; Earlier Post</a>
  {% endif %}
  </div>
  
</div>
