---
title: Siddharth Vashishtha
layout: default
excerpt: Home page of Siddharth Vashishtha's website
permalink: /
---

<br/>

<img class="profile-picture" src="{{site.url}}{{site.baseurl}}/images/profile-picture/sid_dp.jpg">

 Hi! I am Siddharth (Sid). I am a second-year Computer Science Ph.D. student at the [University of Rochester](https://www.cs.rochester.edu/) advised by [Aaron White](http://aaronstevenwhite.io/). My research interests lie at the intersection of Natural Language Processing and Machine Learning. I am especially interested in extracting semantic information from linguistic input.

In May 2019, I graduated from the University of Rochester with a Masters in [Computational Linguistics](http://www.sas.rochester.edu/lin/graduate/MS.html). 

 During my Masters at Rochester, I worked as a graduate researcher with [Aaron Steven White](http://aaronstevenwhite.io/) at the [FACTS Lab](http://factslab.io/), where I  worked on fine-grained temporal relation extraction. I also worked with [James Allen](http://www.cs.rochester.edu/u/james/) on improving semantic parsing using statistical Word Sense Disambiguation. 

 My papers are listed on the [publications](https://sidsvash26.github.io/publications) page.  Full list of publications can be found at [Semantic Scholar](https://www.semanticscholar.org/author/Siddharth-Vashishtha/68972934)/[Google Scholar](https://scholar.google.com/citations?user=Q9l-XJ8AAAAJ&hl=en). 

<!--
Older comments:
## Machine Learning (CSC 446) Office Hours, Spring 2020 
Tuesdays, 2.30pm-3.30pm, Wegmans Hall 2215

Course Webpage: [URL](https://www.cs.rochester.edu/~gildea/2020_Spring/)

Contact: svashis3 \[[strudel](https://en.wikipedia.org/wiki/At_sign)\] cs.rochester.edu
-->

## News
<table>
{% for article in site.data.news %}
<tr>
{% include news.html %}
</tr>
{% endfor %}
</table>
