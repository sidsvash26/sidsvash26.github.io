---
title: Siddharth Vashishtha
layout: default
excerpt: Home page of Siddharth Vashishtha's website
permalink: /
---

<br/>

<img class="profile-picture" src="{{site.url}}{{site.baseurl}}/images/profile-picture/sid_dp.jpg">

I am a second-year graduate student in the [Department of Linguistics](http://www.sas.rochester.edu/lin/graduate/MS.html) at the University of Rochester pursuing an MS in Computational Linguistics. I am currently working as a graduate researcher under [Prof. Aaron Steven White](http://aaronstevenwhite.io/){:target="_blank"} at the [FACTS Lab]((http://factslab.io/)), where I focus on developing annotation frameworks, and building deep neural network architectures to extract semantic information from text. I am also working with [Prof. James Allen](http://www.cs.rochester.edu/u/james/) on improving semantic parsing using statistical Word Sense Disambiguation. Check out my publications page for recent publications.


<br/>

<strong>Research interests</strong> - to work at the intersection of natural language processing and machine learning, especially extracting semantic information from text. Other interests: Semantic Parsing, Common Sense Reasoning, Text Generation etc.

## News
<table cellspacing="0" cellpadding="0">
{% for article in site.data.news %}
<tr>
{% include news.html %}
</tr>
{% endfor %}
</table>
