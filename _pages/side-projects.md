---
layout: default
title: side projects
permalink: /side-projects/
nav: true
nav_order: 5
---

<div class="sp-page">

  <div class="sp-hero">
    <h1 class="sp-title">Fun Side Projects</h1>
    <p class="sp-subtitle">A collection of tools, visualizations, and interactive games — mostly built on weekends, often with the help of AI.</p>
  </div>

  <!-- ═══════════ Spotlight ═══════════ -->
  {% assign spotlight = site.data.side_projects | where: "featured", true %}
  {% for item in spotlight %}
  <a href="{{ item.url | relative_url }}" class="sp-spot">
    <img class="sp-spot__img" src="{{ item.hero_image | default: item.image | relative_url }}" alt="{{ item.title }}">
    <div class="sp-spot__shade"></div>
    <div class="sp-spot__body">
      <span class="sp-spot__eyebrow">{{ item.icon }} Featured project</span>
      <h2 class="sp-spot__title">{{ item.title }}</h2>
      {% if item.tagline %}<p class="sp-spot__tagline">{{ item.tagline }}</p>{% endif %}
      {% if item.highlights %}
      <ul class="sp-spot__chips">
        {% for h in item.highlights %}<li>{{ h }}</li>{% endfor %}
      </ul>
      {% endif %}
      <span class="sp-spot__cta">{{ item.cta | default: "Open" }} →</span>
    </div>
  </a>
  {% endfor %}

  <!-- ═══════════ Tools & Visualizations ═══════════ -->
  {% assign tools = site.data.side_projects | where: "category", "tools" %}
  {% if tools.size > 0 %}
  <section class="sp-section">
    <div class="sp-section-header">
      <span class="sp-section-icon">🛠️</span>
      <div>
        <h2 class="sp-section-title">Tools & Visualizations</h2>
        <p class="sp-section-desc">Data-driven projects that turn your own data into something useful (and pretty).</p>
      </div>
    </div>

    <div class="sp-grid sp-grid--featured">
      {% for item in tools %}
      <a href="{{ item.url | relative_url }}" class="sp-card sp-card--featured">
        <div class="sp-card__image-wrap">
          {% if item.image %}
          <img src="{{ item.image | relative_url }}" alt="{{ item.title }}" loading="lazy">
          {% endif %}
          <span class="sp-card__badge">{{ item.icon }}</span>
        </div>
        <div class="sp-card__body">
          <h3 class="sp-card__title">{{ item.title }}</h3>
          {% if item.tagline %}
          <p class="sp-card__tagline">{{ item.tagline }}</p>
          {% endif %}
          {% if item.description %}
          <div class="sp-card__desc">
            {{ item.description | markdownify }}
          </div>
          {% endif %}
          <span class="sp-card__cta">Try it →</span>
        </div>
      </a>
      {% endfor %}
    </div>
  </section>
  {% endif %}

  <!-- ═══════════ Games ═══════════ -->
  {% assign games = site.data.side_projects | where: "category", "games" %}
  {% if games.size > 0 %}
  <section class="sp-section">
    <div class="sp-section-header">
      <span class="sp-section-icon">🎮</span>
      <div>
        <h2 class="sp-section-title">Interactive Games</h2>
        <p class="sp-section-desc">Learn-by-doing quizzes and drills — great for when you want to practice something in a more fun way.</p>
      </div>
    </div>

    <div class="sp-grid sp-grid--cards">
      {% for item in games %}
      {% if item.featured %}{% continue %}{% endif %}
      <a href="{{ item.url | relative_url }}" class="sp-card">
        <div class="sp-card__image-wrap">
          {% if item.image %}
          <img src="{{ item.image | relative_url }}" alt="{{ item.title }}" loading="lazy">
          {% endif %}
          <span class="sp-card__badge">{{ item.icon }}</span>
        </div>
        <div class="sp-card__body">
          <h3 class="sp-card__title">{{ item.title }}</h3>
          {% if item.tagline %}
          <p class="sp-card__tagline">{{ item.tagline }}</p>
          {% endif %}
          <span class="sp-card__cta">Play →</span>
        </div>
      </a>
      {% endfor %}
    </div>
  </section>
  {% endif %}

</div>

{% include visitor_counter.html %}

<style>
/* ═══════════ Side Projects Page ═══════════ */

.sp-page {
  padding-bottom: 48px;
}

/* Hero */
.sp-hero {
  text-align: center;
  padding: 16px 0 36px;
}
.sp-title {
  font-size: clamp(28px, 5vw, 42px);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 10px;
  background: linear-gradient(135deg, var(--global-theme-color, #7c3aed) 0%, #2dd4bf 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.sp-subtitle {
  max-width: 56ch;
  margin: 0 auto;
  font-size: 16px;
  line-height: 1.55;
  color: var(--global-text-color-light, #666);
}

/* Spotlight */
.sp-spot {
  position: relative;
  display: block;
  min-height: 420px;
  margin-bottom: 48px;
  border-radius: 18px;
  overflow: hidden;
  background: #14181d;
  text-decoration: none !important;
  box-shadow: 0 10px 34px rgba(0,0,0,0.16);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.sp-spot:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 48px rgba(0,0,0,0.26);
}
.sp-spot__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 60% 50%;
  transition: transform 0.6s ease;
}
.sp-spot:hover .sp-spot__img {
  transform: scale(1.04);
}
.sp-spot__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(12,15,19,0.94) 0%, rgba(12,15,19,0.8) 34%, rgba(12,15,19,0.15) 68%, rgba(12,15,19,0) 100%);
}
.sp-spot__body {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 420px;
  max-width: 500px;
  padding: 40px 44px;
  color: #fff;
}
.sp-spot__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #ffd23f;
  margin-bottom: 12px;
}
.sp-spot__title {
  font-size: clamp(34px, 6vw, 52px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.02;
  margin: 0 0 12px;
  color: #fff;
}
.sp-spot__tagline {
  font-size: 17px;
  line-height: 1.45;
  margin: 0 0 18px;
  color: rgba(255,255,255,0.86);
}
.sp-spot__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0 0 26px;
}
.sp-spot__chips li {
  font-size: 12.5px;
  line-height: 1.2;
  padding: 6px 11px;
  border-radius: 999px;
  color: rgba(255,255,255,0.92);
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
}
.sp-spot__cta {
  align-self: flex-start;
  font-size: 15px;
  font-weight: 700;
  padding: 12px 22px;
  border-radius: 10px;
  color: #14181d;
  background: #ffd23f;
  transition: background 0.2s ease, padding 0.2s ease;
}
.sp-spot:hover .sp-spot__cta {
  background: #ffe07a;
  padding-right: 28px;
}

/* Section */
.sp-section {
  margin-bottom: 48px;
}
.sp-section-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--global-divider-color, #e5e7eb);
}
.sp-section-icon {
  font-size: 28px;
  line-height: 1;
  margin-top: 2px;
}
.sp-section-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
  letter-spacing: -0.01em;
}
.sp-section-desc {
  margin: 0;
  font-size: 14px;
  color: var(--global-text-color-light, #888);
  line-height: 1.45;
}

/* Grid */
.sp-grid {
  display: grid;
  gap: 22px;
}
.sp-grid--featured {
  grid-template-columns: 1fr;
}
.sp-grid--cards {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

/* Card */
.sp-card {
  display: flex;
  flex-direction: column;
  background: var(--global-card-bg-color, #fff);
  border: 1px solid var(--global-divider-color, #e5e7eb);
  border-radius: 14px;
  overflow: hidden;
  text-decoration: none !important;
  color: inherit !important;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  cursor: pointer;
}
.sp-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 36px rgba(0,0,0,0.08);
  border-color: var(--global-theme-color, #7c3aed);
}

/* Featured card is horizontal on larger screens */
.sp-card--featured {
  flex-direction: row;
}
.sp-card--featured .sp-card__image-wrap {
  flex: 0 0 42%;
  max-width: 420px;
}
.sp-card--featured .sp-card__image-wrap img {
  height: 100%;
  object-fit: cover;
}
.sp-card--featured .sp-card__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 28px 30px;
}
.sp-card--featured .sp-card__desc {
  display: block;
}

/* Card image */
.sp-card__image-wrap {
  position: relative;
  overflow: hidden;
  background: var(--global-bg-color, #f8f8f8);
}
.sp-card__image-wrap img {
  display: block;
  width: 100%;
  height: auto;
  transition: transform 0.35s ease;
}
.sp-card:hover .sp-card__image-wrap img {
  transform: scale(1.04);
}
.sp-card__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 22px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Card body */
.sp-card__body {
  padding: 20px 22px 22px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.sp-card__title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
  letter-spacing: -0.01em;
}
.sp-card__tagline {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--global-text-color-light, #888);
  line-height: 1.4;
}
.sp-card__desc {
  display: none;
  font-size: 14px;
  line-height: 1.6;
  color: var(--global-text-color, #333);
  margin-bottom: 12px;
}
.sp-card__desc p {
  margin-bottom: 8px;
}
.sp-card__desc p:last-child {
  margin-bottom: 0;
}
.sp-card__cta {
  margin-top: auto;
  font-size: 14px;
  font-weight: 600;
  color: var(--global-theme-color, #7c3aed);
  transition: gap 0.2s ease;
}
.sp-card:hover .sp-card__cta {
  letter-spacing: 0.02em;
}

/* ═══════════ Dark mode adjustments ═══════════ */
html[data-theme="dark"] .sp-card__badge,
body.dark-mode .sp-card__badge {
  background: rgba(30,30,40,0.8);
}
html[data-theme="dark"] .sp-card:hover,
body.dark-mode .sp-card:hover {
  box-shadow: 0 12px 36px rgba(0,0,0,0.35);
}

/* ═══════════ Responsive ═══════════ */
@media (max-width: 640px) {
  .sp-spot,
  .sp-spot__body {
    min-height: 520px;
  }
  .sp-spot__body {
    justify-content: flex-end;
    max-width: none;
    padding: 24px 20px;
  }
  .sp-spot__shade {
    background: linear-gradient(0deg, rgba(12,15,19,0.96) 0%, rgba(12,15,19,0.82) 52%, rgba(12,15,19,0.1) 100%);
  }
  .sp-spot__img {
    object-position: 55% 0;
    height: 55%;
  }
  .sp-card--featured {
    flex-direction: column;
  }
  .sp-card--featured .sp-card__image-wrap {
    flex: none;
    max-width: none;
  }
  .sp-card--featured .sp-card__image-wrap img {
    height: 200px;
    object-fit: cover;
  }
  .sp-card--featured .sp-card__body {
    padding: 20px;
  }
  .sp-grid--cards {
    grid-template-columns: 1fr;
  }
  .sp-section-header {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
