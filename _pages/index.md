---
title: Siddharth Vashishtha
layout: default
excerpt: Home page of Siddharth Vashishtha's website
permalink: /
---

<br/>

<img class="profile-picture" src="{{site.url}}{{site.baseurl}}/images/profile-picture/sid_dp.jpg">

I am currently a graduate researcher under [Prof. Aaron Steven White](http://aaronstevenwhite.io/){:target="_blank"} at the FACTS Lab, [University of Rochester](http://factslab.io/){:target="_blank"}. I am currently working on building neural network architectures for predicting fine-grained temporal relations within English sentences.

I have also worked with [Prof. Schubert](https://www.cs.rochester.edu/~schubert/){:target="_blank"} on turn-taking corpus annotations of LISSA, a virtual agent designed to improve communication skills of ASD teens and old-aged people.  

Previously, I worked as a Senior Consultant at [EXL Services](https://www.exlservice.com/analytics){:target="_blank"} on developing credit portfolio strategies for major retail banks in Africa and UK. 

I graduated from [IIT Kharagpur, India](http://www.iitkgp.ac.in/){:target="_blank"}, in 2014 with a Dual Degree (B.Tech. (H) + M.Tech.) in Agricultural and Food Engineering, my Master's specialization was Food Process Engineering.

<br/>

<strong>Research interests</strong> - to work at the intersection of natural language processing and machine learning, especially extracting semantic information from text. Othere interests: Machine Translation, Common Sense Reasoning, Text Generation.

## News

<ul>
{% for article in site.data.news %}

{% include news.html %}

{% endfor %}
</ul>
