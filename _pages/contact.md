---
layout: page
permalink: /contact/
title: contact
description: Get in touch
nav: true
---

<style>
  .contact-hero {
    text-align: center;
    padding: 10px 0 36px 0;
  }
  .contact-hero p {
    font-size: 1.05em;
    color: var(--global-text-color-light, #666);
    max-width: 420px;
    margin: 0 auto;
    line-height: 1.6;
  }

  .contact-email-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 24px;
    border-radius: 14px;
    background: var(--global-card-bg-color, #f8f9fa);
    border: 1.5px solid var(--global-divider-color, #e9ecef);
    margin: 0 auto 40px auto;
    max-width: 440px;
    font-size: 1em;
    color: var(--global-text-color, #333);
    transition: box-shadow 0.2s, border-color 0.2s;
  }
  .contact-email-card:hover {
    box-shadow: 0 4px 20px rgba(66,133,244,0.10);
    border-color: rgba(66,133,244,0.35);
  }
  .contact-email-icon {
    width: 42px; height: 42px;
    border-radius: 50%;
    background: linear-gradient(135deg, #4285f4, #34a853);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: #fff;
    font-size: 1.1em;
  }
  .contact-email-label {
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--global-text-color-light, #999);
    margin-bottom: 3px;
  }
  .contact-email-value {
    font-size: 0.95em;
    color: var(--global-text-color, #333);
    font-family: monospace;
  }

  .contact-social-label {
    text-align: center;
    font-size: 0.75em;
    font-weight: 600;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: var(--global-text-color-light, #aaa);
    margin-bottom: 18px;
  }

  .contact-social-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    max-width: 500px;
    margin: 0 auto;
  }

  .contact-social-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 20px;
    border-radius: 12px;
    border: 1.5px solid var(--global-divider-color, #e9ecef);
    background: var(--global-card-bg-color, #fff);
    color: var(--global-text-color, #333);
    font-size: 0.92em;
    font-weight: 500;
    text-decoration: none;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    min-width: 140px;
    justify-content: center;
  }
  .contact-social-btn:hover {
    text-decoration: none;
    transform: translateY(-3px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.10);
  }
  .contact-social-btn i { font-size: 1.1em; }

  .contact-social-btn.tw:hover  { border-color: #1DA1F2; color: #1DA1F2; box-shadow: 0 6px 20px rgba(29,161,242,0.15); }
  .contact-social-btn.li:hover  { border-color: #0A66C2; color: #0A66C2; box-shadow: 0 6px 20px rgba(10,102,194,0.15); }
  .contact-social-btn.gh:hover  { border-color: #333;    color: #333;    box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
  .contact-social-btn.yt:hover  { border-color: #FF0000; color: #FF0000; box-shadow: 0 6px 20px rgba(255,0,0,0.15); }
  .contact-social-btn.gs:hover  { border-color: #4285f4; color: #4285f4; box-shadow: 0 6px 20px rgba(66,133,244,0.15); }

  [data-theme="dark"] .contact-social-btn.gh:hover { border-color: #e0e0e0; color: #e0e0e0; }
</style>

<div class="contact-hero">
  <p>I'm always happy to connect — reach out via email or find me on any of the platforms below.</p>
</div>

<div class="contact-email-card">
  <div class="contact-email-icon"><i class="fas fa-envelope"></i></div>
  <div>
    <div class="contact-email-label">Email</div>
    <div class="contact-email-value">{lastname}.sid&nbsp;&nbsp;[<a href="https://en.wikipedia.org/wiki/At_sign" target="_blank" rel="noopener">nutella</a>]&nbsp;&nbsp;gmail.com</div>
  </div>
</div>

<div class="contact-social-label">Find me online</div>

<div class="contact-social-grid">
  <a href="https://www.twitter.com/{{ site.twitter_username }}" target="_blank" rel="noopener" class="contact-social-btn tw">
    <i class="fab fa-twitter"></i> Twitter
  </a>
  <a href="https://linkedin.com/in/{{ site.linkedin_username }}" target="_blank" rel="noopener" class="contact-social-btn li">
    <i class="fab fa-linkedin"></i> LinkedIn
  </a>
  <a href="https://github.com/{{ site.github_username }}" target="_blank" rel="noopener" class="contact-social-btn gh">
    <i class="fab fa-github"></i> GitHub
  </a>
  <a href="https://www.youtube.com/@{{ site.youtube_id }}" target="_blank" rel="noopener" class="contact-social-btn yt">
    <i class="fab fa-youtube"></i> YouTube
  </a>
  <a href="https://scholar.google.com/citations?user=4Q4zhC0AAAAJ&hl=en" target="_blank" rel="noopener" class="contact-social-btn gs">
    <i class="ai ai-google-scholar"></i> Google Scholar
  </a>
</div>
