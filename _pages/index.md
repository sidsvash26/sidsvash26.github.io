---
title: Siddharth Vashishtha
layout: default
excerpt: Home page of Siddharth Vashishtha's website
permalink: /
---

<br/>

<img class="profile-picture" src="{{site.url}}{{site.baseurl}}/images/profile-picture/sid_dp.jpg">

 Hello world! I am Siddharth (Sid). I recently graduated from the University of Rochester with a Masters in [Computational Linguistics] ((http://www.sas.rochester.edu/lin/graduate/MS.html)). I'll start my PhD in Computer Science at the University of Rochester in Fall 2019. 

 I like working on Natural Language Processing and Machine Learning. Semantics is my favorite area in Linguistics. I am specially interested in extracting semantic information from linguistic input. 

 During my Masters at Rochester, I worked as a graduate researcher under Assistant Professor [Aaron Steven White](http://aaronstevenwhite.io/){:target="_blank"} at the [FACTS Lab]((http://factslab.io/)), where I  worked on fine-grained temporal relation extraction. I also worked with [Prof. James Allen](http://www.cs.rochester.edu/u/james/) on improving semantic parsing using statistical Word Sense Disambiguation. Check out my publications page for recent publications.


<br/>

<!-- <strong>Research interests</strong> - to work at the intersection of natural language processing and machine learning, especially extracting semantic information from text. Other interests: Semantic Parsing, Common Sense Reasoning, Text Generation etc. -->

## News
<table>
{% for article in site.data.news %}
<tr>
{% include news.html %}
</tr>
{% endfor %}
</table>
