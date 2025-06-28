---
layout: default
title: blog
permalink: /blog/
nav: false
nav_order: 3
---

Welcome to my blog! Here you'll find in-depth posts, essays, and interactive explorations.

<div class="blog-list">
{% for post in site.data.blog %}
  <div class="blog-item">
    <div class="blog-media">
      {% if post.image %}
        <img src="{{ post.image | relative_url }}" alt="{{ post.title }}">
      {% endif %}
      <a href="{{ post.url | relative_url }}" class="btn btn-primary" title="Read {{ post.title }}">Read Post</a>
    </div>
    <div class="blog-details">
      <h2>{{ post.title }}</h2>
      {% if post.description %}
        <div class="blog-description-box">
          {{ post.description }}
        </div>
      {% endif %}
      <div class="blog-tags">
        {% for tag in post.tags %}
          <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">{{ tag }}</span>
        {% endfor %}
      </div>
    </div>
  </div>
  <hr>
{% endfor %}
</div>

<style>
.blog-list {
  margin-top: 20px;
}
.blog-item {
  display: flex;
  align-items: flex-start;
  gap: 25px;
  margin-bottom: 40px;
}
.blog-media {
  flex: 0 0 300px;
}
.blog-media img {
  display: block;
  width: 100%;
  max-width: 300px;
  height: auto;
  border: 1px solid #eee;
  margin-bottom: 15px;
}
.blog-media .btn {
  display: block;
  text-align: center;
}
.blog-details {
  flex: 1;
  min-width: 0;
}
.blog-details h2 {
  margin-top: 0;
  margin-bottom: 15px;
}
.blog-description-box {
  padding: 15px;
  border-radius: 5px;
  line-height: 1.6;
  background-color: #f9f9f9;
  color: #333;
  border: 1px solid #eee;
}
.blog-tags {
  margin-top: 10px;
}
.blog-tags span {
  margin-right: 5px;
  margin-bottom: 5px;
}
.blog-list + hr,
.blog-item + hr {
  margin-top: 40px;
  margin-bottom: 40px;
  border: 0;
  border-top: 1px solid #eee;
}
@media (max-width: 767px) {
  .blog-item {
    flex-direction: column;
    gap: 15px;
  }
  .blog-media {
    flex-basis: auto;
    width: 100%;
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }
  .blog-media img {
    width: 100%;
    max-width: 300px;
  }
  .blog-details {
    flex-basis: auto;
    width: 100%;
  }
  .blog-details h2 {
    text-align: center;
  }
}
</style>
