---
layout: default
title: games
permalink: /games/
nav: true
nav_order: 5
---

Welcome to my collection of simple HTML games, often created with the help of AI!

<div class="game-list">
{% for game in site.data.games %}
  <div class="game-item">

    <div class="game-media">
      {% if game.image %}
        <img src="{{ game.image | relative_url }}" alt="{{ game.title }} Screenshot">
      {% endif %}
      <a href="{{ game.url | relative_url }}" class="btn btn-primary" title="Play {{ game.title }}">Play Game</a>
    </div>

    <div class="game-details">
      <h2>{{ game.title }}</h2>
      {% if game.description %}
        <div class="game-description-box">
          {{ game.description | markdownify }}
        </div>
      {% endif %}
    </div>

  </div>
  <hr>
{% endfor %}
</div>

<style>
/* Styles for the Games Page List - Now using Theme CSS Variables */
.game-list {
  margin-top: 20px;
}

.game-item {
  display: flex;
  align-items: flex-start;
  gap: 25px;
  margin-bottom: 40px;
}

.game-media {
  flex: 0 0 300px;
}

.game-media img {
  display: block;
  width: 100%;
  max-width: 300px;
  height: auto;
  /* Use theme's divider/border color */
  border: 1px solid var(--global-divider-color, #eee);
  margin-bottom: 15px;
}

.game-media .btn {
  display: block;
  text-align: center;
}

.game-details {
  flex: 1;
  min-width: 0;
}

.game-details h2 {
  margin-top: 0;
  margin-bottom: 15px;
  /* Optional: Use theme's text color for heading too if needed */
  /* color: var(--global-text-color); */
}

.game-description-box {
  padding: 15px;
  border-radius: 5px;
  line-height: 1.6;
  /* --- Use Theme CSS Variables --- */
  background-color: var(--global-card-bg-color, #f9f9f9); /* Use card background */
  color: var(--global-text-color, #333);             /* Use standard text color */
  border: 1px solid var(--global-divider-color, #eee); /* Use divider/border color */
}

/* Separator */
.game-list + hr,
.game-item + hr {
  margin-top: 40px;
  margin-bottom: 40px;
  border: 0;
  /* Use theme's divider/border color */
  border-top: 1px solid var(--global-divider-color, #eee);
}
</style>
