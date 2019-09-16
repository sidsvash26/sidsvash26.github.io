---
title: Siddharth Vashishtha
layout: default
excerpt: Home page of Siddharth Vashishtha's website
permalink: /
---

<br/>

<img class="profile-picture" src="{{site.url}}{{site.baseurl}}/images/profile-picture/sid_dp.jpg">

 Hi! I am Siddharth (Sid). I am a first-year Computer Science Ph.D. student at the [University of Rochester](https://www.cs.rochester.edu/). My research interests lie at the intersection of Natural Language Processing and Machine Learning. I am especially interested in extracting semantic information from linguistic input.

I recently graduated from the University of Rochester with a Masters in [Computational Linguistics](http://www.sas.rochester.edu/lin/graduate/MS.html). 

 During my Masters at Rochester, I worked as a graduate researcher with [Aaron Steven White](http://aaronstevenwhite.io/){:target="_blank"} at the [FACTS Lab]((http://factslab.io/)), where I  worked on fine-grained temporal relation extraction. I also worked with [James Allen](http://www.cs.rochester.edu/u/james/) on improving semantic parsing using statistical Word Sense Disambiguation. 

 My papers are listed on the publications page. 

<br/>

<!-- <strong>Research interests</strong> - to work at the intersection of natural language processing and machine learning, especially extracting semantic information from text. Other interests: Semantic Parsing, Common Sense Reasoning, Text Generation etc. -->
## Faux NSF Mini-proposal ITRG for CSC400:
My faux NSF ITRG miniproposal for CSC400 can be accessed at: [Mini-Proposal](http://sidsvash26.github.io/docs/NSF_mini_proposal.pdf)


## News
<table>
{% for article in site.data.news %}
<tr>
{% include news.html %}
</tr>
{% endfor %}
</table>
