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

<!-- Visitor counter at the very end -->
<div class="visitor-counter" style="text-align:center;margin-top:60px;padding:20px;border-top:1px solid var(--global-divider-color,#e9ecef);background-color:var(--global-card-bg-color,#f8f9fa);color:var(--global-text-color,#6c757d);font-size:0.9em;">
  <div class="date-line" style="margin-bottom:5px;color:var(--global-text-color,#6c757d);">Total global website visits:</div>
  <div class="count-line" style="font-size:1.2em;font-weight:500;color:var(--global-text-color,#495057);">
    <a href="https://www.hitwebcounter.com" target="_blank">
      <img src="https://hitwebcounter.com/counter/counter.php?page=12345678&style=0006&nbdigits=5&type=page&initCount=0" title="Web Counter" alt="web counter" border="0" />
    </a>
  </div>
</div>

<style>
/* --- Base Styles (Desktop First) --- */
.game-list {
  margin-top: 20px;
}

.game-item {
  display: flex; /* Side-by-side layout by default */
  align-items: flex-start;
  gap: 25px; /* Space between image and details */
  margin-bottom: 40px;
}

.game-media {
  flex: 0 0 300px; /* Fixed width for image/button area on desktop */
  /* max-width: 300px; */ /* Redundant with flex-basis */
}

.game-media img {
  display: block;
  width: 100%; /* Image fills its container */
  max-width: 300px; /* Max image width */
  height: auto;
  border: 1px solid var(--global-divider-color, #eee);
  margin-bottom: 15px;
}

.game-media .btn {
  display: block;
  text-align: center;
}

.game-details {
  flex: 1; /* Takes remaining space on desktop */
  min-width: 0; /* Prevents flex overflow */
}

.game-details h2 {
  margin-top: 0;
  margin-bottom: 15px;
}

.game-description-box {
  padding: 15px;
  border-radius: 5px;
  line-height: 1.6;
  background-color: var(--global-card-bg-color, #f9f9f9);
  color: var(--global-text-color, #333);
  border: 1px solid var(--global-divider-color, #eee);
}

/* Separator */
.game-list + hr,
.game-item + hr {
  margin-top: 40px;
  margin-bottom: 40px;
  border: 0;
  border-top: 1px solid var(--global-divider-color, #eee);
}

/* --- Mobile Styles (screens up to 767px wide) --- */
@media (max-width: 767px) {
  .game-item {
    flex-direction: column; /* Stack elements vertically */
    gap: 15px; /* Reduce gap for vertical stacking */
  }

  .game-media {
    flex-basis: auto; /* Allow width to be flexible */
    width: 100%; /* Take full width */
    max-width: 300px; /* Optional: Still limit max width */
    margin-left: auto;  /* Center the media block if max-width applies */
    margin-right: auto; /* Center the media block if max-width applies */
  }

  .game-media img {
     /* Max width is already handled by container, ensure it scales */
     width: 100%; /* Ensure image uses container width */
     max-width: 300px; /* Match container max-width if set */
  }

  .game-details {
    flex-basis: auto; /* Allow width to be flexible */
    width: 100%; /* Take full width */
  }

  .game-details h2 {
     text-align: center; /* Optional: Center heading on mobile */
  }

   .game-description-box {
      /* Add any mobile-specific adjustments if needed */
   }
}

</style>
