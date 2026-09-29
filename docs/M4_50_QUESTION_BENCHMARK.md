# VeriAI 50-Question Benchmark Dataset Specification

## 1. Overview & Objective
This document outlines the **50-Question Benchmark Validation Dataset** (`data/m4_benchmark_50.csv`) engineered to rigorously validate the **VeriAI Multi-Agent AI Response Validation System**.

The benchmark tests the system across 10 balanced domains with varying degrees of response accuracy, hallucination, factual omission, and semantic equivalence.

---

## 2. Dataset Composition & Categories
The dataset contains exactly **50 questions** distributed equally across 10 core categories (5 questions per category):

1. **General Knowledge** (IDs 1–5): Canonical factual questions (geopolitical capitals, calendars, culture, literature).
2. **Science** (IDs 6–10): Physical, chemical, and biological sciences with precise terminology.
3. **History** (IDs 11–15): Significant events, dates, civilizational history, and historical leadership.
4. **Geography** (IDs 16–20): Spatial features, capital cities, monuments, and global landforms.
5. **Computer Science** (IDs 21–25): Data structures, algorithmic complexity, architectural definitions, and DB concepts.
6. **Mathematics** (IDs 26–30): Arithmetic calculations, geometry theorems, number theory, and statistics.
7. **Technology** (IDs 31–35): Internet protocols, semiconductor scaling laws, cloud architectures, and cryptography.
8. **Economics** (IDs 36–40): Macroeconomic indicators, market laws, central banking, and fiscal policies.
9. **Everyday Factual Questions** (IDs 41–45): Common measurements, emergency services, biological facts, and health knowledge.
10. **Technical/Explanatory Questions** (IDs 46–50): Multi-step conceptual explanations, systems engineering, and pathology.

---

## 3. Response Quality Archetypes

To ensure a realistic evaluation landscape, the 50 responses represent distinct quality archetypes:
- **Clearly Correct (14 items)**: Accurate, direct answers closely matching reference facts (`PASS`, low risk).
- **Semantically Correct / Paraphrased (11 items)**: Formulated in different phrasing or vocabulary with equivalent meaning (`PASS`, low risk).
- **Partially Correct (5 items)**: Accurate in one element but vague or partially incomplete in another (`REVIEW`, low risk).
- **Incomplete (6 items)**: Omits one or more required multi-part aspects (`REVIEW`, low risk).
- **Factually Incorrect (5 items)**: Incorrect numbers, dates, or historical actors (`FAIL`, high risk).
- **Hallucinated / Unsupported (5 items)**: Introduces completely fabricated, ungrounded details (`FAIL`, high risk).
- **Contradictory to Reference (4 items)**: Asserts the direct opposite or mutually exclusive alternative to the reference (`FAIL`, high risk).

---

## 4. Complete Benchmark Catalog

| ID | Category | Question | Reference Answer | AI Response | Quality Archetype | Expected Hallucination | Expected Verdict |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **1** | General Knowledge | Who wrote the play Romeo and Juliet? | William Shakespeare wrote Romeo and Juliet. | The tragic play Romeo and Juliet was written by William Shakespeare in the late 16th century. | semantically_correct | no | PASS |
| **2** | General Knowledge | What is the currency of Japan? | The currency of Japan is the Japanese yen. | The official currency of Japan is the yen (JPY). | clearly_correct | no | PASS |
| **3** | General Knowledge | How many days are in a standard leap year? | A standard leap year has 366 days. | A leap year contains 365 days just like a regular calendar year. | contradictory | high | FAIL |
| **4** | General Knowledge | Who was the first person to walk on the Moon and in what year? | Neil Armstrong was the first person to walk on the Moon in 1969. | Neil Armstrong walked on the Moon during the Apollo 11 mission but the year of the lunar landing was 1974. | factually_incorrect | high | FAIL |
| **5** | General Knowledge | What are the primary colors in traditional subtractive color theory? | The primary colors are red yellow and blue. | The primary colors include red and blue. | incomplete | no | REVIEW |
| **6** | Science | What gas do humans primarily breathe in for cellular respiration? | Humans primarily inhale oxygen for cellular respiration. | Humans breathe in oxygen which is transported by hemoglobin to cells for respiration. | semantically_correct | no | PASS |
| **7** | Science | What is the boiling point of water at standard atmospheric pressure? | Water boils at 100 degrees Celsius (212 degrees Fahrenheit) at 1 atmosphere. | At standard sea-level atmospheric pressure water boils at 100 degrees Celsius. | clearly_correct | no | PASS |
| **8** | Science | Which organelle is known as the powerhouse of the cell and what does it produce? | The mitochondrion is known as the powerhouse of the cell and produces ATP. | The mitochondria are known as cellular powerhouses because they produce ATP energy although some prokaryotes also possess giant external mitochondria. | hallucinated | high | FAIL |
| **9** | Science | What causes tides in the Earth's oceans? | Ocean tides are caused primarily by the gravitational pull of the Moon and the Sun on the Earth. | Ocean tides are primarily generated by the gravitational attraction exerted by the Moon. | partially_correct | no | REVIEW |
| **10** | Science | What is the chemical symbol for gold? | The chemical symbol for gold is Au. | The chemical symbol for gold on the periodic table is Ag. | contradictory | high | FAIL |
| **11** | History | In what year did World War II end in Europe? | World War II ended in Europe in 1945. | World War II concluded in Europe in May 1945 with the unconditional surrender of Nazi Germany. | semantically_correct | no | PASS |
| **12** | History | Who was the first President of the United States? | George Washington was the first President of the United States. | George Washington served as the first President of the United States from 1789 to 1797. | clearly_correct | no | PASS |
| **13** | History | Which ancient civilization built Machu Picchu? | Machu Picchu was built by the Inca civilization. | Machu Picchu was constructed by the Aztec empire under Moctezuma II in the 15th century. | factually_incorrect | high | FAIL |
| **14** | History | What was the significance of the Magna Carta signed in 1215? | The Magna Carta established the principle that everyone even the king is subject to the law and protected individual rights. | The Magna Carta was signed in 1215 by King John of England but its content focused exclusively on maritime trade tariffs. | hallucinated | high | FAIL |
| **15** | History | Who was the British Prime Minister during most of World War II? | Winston Churchill was the British Prime Minister during most of World War II. | Winston Churchill led the United Kingdom during the war. | clearly_correct | no | PASS |
| **16** | Geography | What is the capital of France? | The capital of France is Paris. | Paris is the capital and most populous city of France. | clearly_correct | no | PASS |
| **17** | Geography | What is the largest ocean on Earth? | The Pacific Ocean is the largest ocean on Earth. | The Pacific Ocean is the largest and deepest of the world's oceans. | clearly_correct | no | PASS |
| **18** | Geography | Which country is home to the Great Pyramid of Giza? | The Great Pyramid of Giza is located in Egypt. | The Great Pyramid of Giza is located in Jordan near Petra. | contradictory | high | FAIL |
| **19** | Geography | Which mountain is the highest peak above sea level? | Mount Everest is the highest mountain peak above sea level at 8848 meters. | Mount Everest in the Himalayas is the highest mountain peak above sea level on Earth. | semantically_correct | no | PASS |
| **20** | Geography | What are the two longest rivers in South America? | The Amazon River and the Parana River are the two longest rivers in South America. | The Amazon River is the longest river in South America. | incomplete | no | REVIEW |
| **21** | Computer Science | What does CPU stand for? | CPU stands for Central Processing Unit. | CPU is an abbreviation for Central Processing Unit. | clearly_correct | no | PASS |
| **22** | Computer Science | What data structure operates on a Last-In First-Out basis? | A stack is a linear data structure that operates on a Last-In First-Out basis. | A queue operates on a Last-In First-Out basis where elements added last are removed first. | contradictory | high | FAIL |
| **23** | Computer Science | What is the worst-case time complexity of quicksort and merge sort? | Quicksort has a worst-case time complexity of O(n^2) while merge sort has O(n log n). | Quicksort runs in O(n^2) worst-case time when pivot selection is poor whereas merge sort maintains O(n log n) worst-case time complexity., | semantically_correct | no | PASS |
| **24** | Computer Science | What is a primary key in a relational database? | A primary key is a column or set of columns that uniquely identifies each row in a database table. | A primary key uniquely identifies each row in a table and was invented by Bill Gates in 1995 for Windows NT. | hallucinated | high | FAIL |
| **25** | Computer Science | What is the difference between a process and a thread in operating systems? | A process is an independent executing program with its own memory space whereas a thread is a lightweight unit of execution within a process that shares memory with other threads. | A process is an executing program instance with its own dedicated address space. | incomplete | no | REVIEW |
| **26** | Mathematics | What is the square root of 144? | The principal square root of 144 is 12. | The square root of 144 is 12. | clearly_correct | no | PASS |
| **27** | Mathematics | What is the sum of the interior angles of a triangle in Euclidean geometry? | The sum of the interior angles of a triangle is always 180 degrees. | In Euclidean geometry the three interior angles of any triangle always add up to 180 degrees. | semantically_correct | no | PASS |
| **28** | Mathematics | What is 15 percent of 200? | 15 percent of 200 is 30. | 15 percent of 200 is 45. | factually_incorrect | high | FAIL |
| **29** | Mathematics | What is a prime number and what is the smallest prime number? | A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself; 2 is the smallest prime number. | A prime number has only two divisors: 1 and itself. The smallest prime number is 1. | contradictory | high | FAIL |
| **30** | Mathematics | What are the mean and median of the dataset [4 8 6 12 10]? | The mean is 8 and the median is 8. | The mean of the numbers is 8. | incomplete | no | REVIEW |
| **31** | Technology | What does HTTP stand for in web technology? | HTTP stands for Hypertext Transfer Protocol. | HTTP stands for Hypertext Transfer Protocol which is the foundation of data communication on the World Wide Web. | semantically_correct | no | PASS |
| **32** | Technology | What is the purpose of DNS on the internet? | DNS translates human-readable domain names into numerical IP addresses. | The Domain Name System translates domain names like example.com into machine-readable IP addresses. | clearly_correct | no | PASS |
| **33** | Technology | What is Moore's Law in semiconductor technology? | Moore's Law is the observation that the number of transistors on a microchip doubles roughly every two years. | Moore's Law states that CPU clock speeds quadruple every six months while halving total power consumption. | factually_incorrect | high | FAIL |
| **34** | Technology | What is cloud computing? | Cloud computing is the on-demand delivery of computing services including servers storage databases networking and software over the internet. | Cloud computing delivers computing power storage and database services over the internet on a pay-as-you-go model. | semantically_correct | no | PASS |
| **35** | Technology | What is the difference between symmetric and asymmetric encryption? | Symmetric encryption uses a single shared key for both encryption and decryption whereas asymmetric encryption uses a public-private key pair. | Symmetric encryption relies on a single secret key for both encrypting and decrypting data. | incomplete | no | REVIEW |
| **36** | Economics | What is inflation in economics? | Inflation is the general increase in prices and fall in the purchasing power of money over time. | Inflation represents a sustained increase in the general price level of goods and services eroding consumer purchasing power. | semantically_correct | no | PASS |
| **37** | Economics | What does GDP stand for and what does it measure? | GDP stands for Gross Domestic Product and measures the total monetary value of all finished goods and services produced within a country in a specific time period. | Gross Domestic Product measures the total economic output and market value of all final goods and services produced within a nation. | clearly_correct | no | PASS |
| **38** | Economics | What is the law of demand in microeconomics? | The law of demand states that all else being equal as the price of a good increases consumer demand for that good decreases. | The law of demand states that as prices rise consumer quantity demanded increases proportionally because consumers prefer expensive items. | contradictory | high | FAIL |
| **39** | Economics | What is a central bank's primary role in monetary policy? | A central bank manages a country's money supply and interest rates to promote price stability control inflation and support economic growth. | A central bank sets interest rates and regulates money supply and it guarantees that every citizen receives a mandatory Bitcoin stipend. | hallucinated | high | FAIL |
| **40** | Economics | What is the difference between fiscal policy and monetary policy? | Fiscal policy is set by the government through taxation and spending whereas monetary policy is managed by the central bank through interest rates and money supply. | Fiscal policy involves government decisions regarding taxation and public spending levels. | partially_correct | no | REVIEW |
| **41** | Everyday Factual Questions | What is the freezing point of pure water at standard atmospheric pressure in Celsius? | Pure water freezes at 0 degrees Celsius at standard atmospheric pressure. | Water freezes into ice at 0 degrees Celsius under standard atmospheric pressure. | clearly_correct | no | PASS |
| **42** | Everyday Factual Questions | How many hours are in one week? | There are 168 hours in one week (24 hours per day multiplied by 7 days). | There are 168 hours in a standard seven-day week. | clearly_correct | no | PASS |
| **43** | Everyday Factual Questions | Which vitamin is synthesized in human skin when exposed to sunlight? | Vitamin D is synthesized in the skin upon exposure to ultraviolet sunlight. | Exposure to natural sunlight triggers the synthesis of Vitamin C in epidermal cells. | contradictory | high | FAIL |
| **44** | Everyday Factual Questions | What is the standard emergency telephone number in the United States? | The emergency telephone number in the United States is 911. | In the United States 911 connects callers directly to emergency dispatch services. | semantically_correct | no | PASS |
| **45** | Everyday Factual Questions | What are the common symptoms of influenza? | Common flu symptoms include fever chills muscle aches cough congestion runny nose headaches and fatigue. | Influenza frequently causes fever and a cough. | partially_correct | no | REVIEW |
| **46** | Technical/Explanatory Questions | Explain the difference between TCP and UDP protocols. | TCP is a connection-oriented protocol that ensures reliable ordered data delivery whereas UDP is connectionless and prioritizes speed with no delivery guarantee. | TCP provides connection-oriented reliable transmission with error checking whereas UDP is connectionless and optimizes for low-latency transmission. | semantically_correct | no | PASS |
| **47** | Technical/Explanatory Questions | What causes type 1 diabetes mellitus? | Type 1 diabetes is caused by autoimmune destruction of insulin-producing pancreatic beta cells resulting in absolute insulin deficiency. | Type 1 diabetes is an autoimmune disease where the immune system destroys insulin-producing beta cells in the pancreas causing absolute insulin deficiency. | clearly_correct | no | PASS |
| **48** | Technical/Explanatory Questions | How does public key cryptography achieve secure key exchange without a shared secret? | Public key cryptography uses mathematically linked asymmetric key pairs allowing a sender to encrypt messages with the recipient's public key which only the recipient's private key can decrypt. | Public key cryptography allows secure communication using asymmetric keys where a sender encrypts data using a public key and only the matching private key can decrypt it. | semantically_correct | no | PASS |
| **49** | Technical/Explanatory Questions | What is an index in a database and what is the trade-off of using one? | A database index speeds up data retrieval queries at the cost of additional storage space and slower write operations. | A database index speeds up SELECT search queries across tables but it completely eliminates the need for disk storage by storing tables in quantum RAM. | hallucinated | high | FAIL |
| **50** | Technical/Explanatory Questions | Explain the ACID properties in database management systems. | ACID stands for Atomicity Consistency Isolation and Durability guaranteeing reliable transaction processing in databases. | ACID stands for Atomicity and Consistency in transaction management. | incomplete | no | REVIEW |
