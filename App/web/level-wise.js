'use strict';
// PDF-guided study priorities, linked to existing questions and shared progress.
const LevelWise={
 groups:[
  {id:'core',title:'Maths, numbers & complexity',tags:['Math','Mathematics','Number Theory','Complexity','Big O','Loops','Conditions','Patterns','Pattern','Recursion'],hint:/\b(complexity|prime|factorial|fibonacci|pattern|second.largest|number triangle|linear search)\b/i},
  {id:'arrays',title:'Arrays & matrices',tags:['Array','Arrays','Matrix'],hint:/\b(array|arrays|matrix)\b/i},
  {id:'strings',title:'Strings & frequency',tags:['String','Strings','Counting','String Matching'],hint:/\b(string|palindrome|anagram|frequency)\b/i},
  {id:'search-sort',title:'Searching & sorting',tags:['Binary Search','Searching','Search','Sorting','Sort','Bubble Sort','Selection Sort','Insertion Sort','Merge Sort','Quick Sort'],hint:/\b(binary search|linear search|bubble sort|selection sort|insertion sort|sorting)\b/i},
  {id:'hashing',title:'Hash maps & sets',tags:['Hash Table','Hashing','Hash Map','HashMap','Hash Set','Set','Map']},
  {id:'lists',title:'Linked lists',tags:['Linked List','LinkedList','Doubly-Linked List'],hint:/linked.list/i},
  {id:'stack-queue',title:'Stacks & queues',tags:['Stack','Queue','Monotonic Stack','Monotonic Queue'],hint:/\b(stack|queue|parentheses)\b/i},
  {id:'two-pointers',title:'Two pointers',tags:['Two Pointers','TwoPointers']},
  {id:'sliding-window',title:'Sliding window',tags:['Sliding Window']},
  {id:'prefix',title:'Prefix sums',tags:['Prefix Sum','Prefix Sums']},
  {id:'intervals',title:'Intervals',tags:['Interval','Intervals'],hint:/\b(interval|intervals|meeting rooms)\b/i},
  {id:'trees',title:'Trees, BST & traversals',tags:['Tree','Binary Tree','Binary Search Tree','BST'],hint:/\b(tree|bst|traversal)\b/i},
  {id:'graphs',title:'Graphs, BFS & DFS',tags:['Graph','Depth-First Search','Breadth-First Search','DFS','BFS'],hint:/\b(islands|flood fill|graph|breadth.first|depth.first)\b/i},
  {id:'heap',title:'Heaps & priority queues',tags:['Heap','Heap (Priority Queue)','Priority Queue']},
  {id:'greedy',title:'Greedy algorithms',tags:['Greedy']},
  {id:'backtracking',title:'Recursion & backtracking',tags:['Backtracking','Recursion'],hint:/\b(backtrack|permutation|combination)\b/i},
  {id:'dp',title:'Dynamic programming',tags:['Dynamic Programming','DP','Memoization','Tree DP','Knapsack','Longest Increasing Subsequence'],hint:/\b(coin change|word break|longest increasing subsequence)\b/i},
  {id:'shortest-path',title:'Shortest paths',tags:['Shortest Path','Dijkstra','Bellman-Ford','Floyd-Warshall'],hint:/\b(shortest path|network delay|dijkstra)\b/i},
  {id:'topological',title:'Topological sort',tags:['Topological Sort','Directed Acyclic Graph'],hint:/course schedule/i},
  {id:'union-find',title:'Union-find',tags:['Union Find','Disjoint Set']},
  {id:'trie',title:'Tries',tags:['Trie'],hint:/\b(trie|prefix tree)\b/i},
  {id:'range',title:'Segment & indexed trees',tags:['Segment Tree','Binary Indexed Tree','Range Query']},
  {id:'bits',title:'Bit manipulation',tags:['Bit Manipulation','Bits','Bitmask'],hint:/\b(bitwise|set bits)\b/i},
  {id:'design',title:'Data structure design',tags:['Design','Data Stream','Ordered Set'],hint:/\b(lru|lfu) cache/i}
 ],
 levels:[
  {id:'service',code:'01',title:'Service-Based Companies',subtitle:'Build a strong foundation',difficulty:['Easy'],groupIds:['core','arrays','strings','search-sort','hashing','lists','stack-queue'],pdf:'DSA_01_Service_Based_Companies.pdf',companies:['TCS','Infosys','Wipro','Accenture','Cognizant','HCLTech','Capgemini','Tech Mahindra','LTIMindtree','DXC Technology','CGI','Zensar'],focus:'Mostly Easy · speed, accuracy and clear explanations',tips:['Start with prime numbers, factorial, Fibonacci and basic patterns.','Practise reverse array/string, second-largest, frequency counts and palindromes.','Explain edge cases and time/space complexity.'],exclude:['Database','Pandas','JavaScript','Shell','Concurrency','Dynamic Programming','Graph','Tree','Binary Tree','Binary Search Tree','Depth-First Search','Breadth-First Search','Heap (Priority Queue)','Greedy','Backtracking','Union Find','Trie','Segment Tree','Binary Indexed Tree']},
  {id:'product',code:'02',title:'Product, Fintech & Finance',subtitle:'Strengthen your core patterns',difficulty:['Easy','Medium'],groupIds:['core','arrays','strings','search-sort','hashing','lists','stack-queue','two-pointers','sliding-window','prefix','intervals','trees','graphs','heap','greedy','backtracking','dp','shortest-path'],pdf:'DSA_02_Mid_Tier_Product_Fintech_Companies.pdf',companies:['Walmart Global Tech','Flipkart','Paytm','Myntra','Razorpay','Swiggy','Ola','OYO','BookMyShow','Expedia','JPMorgan Chase','Goldman Sachs','Wells Fargo','American Express'],focus:'Easy to Medium · patterns and optimized solutions',tips:['Start with Two Sum, longest substring, merge intervals and valid parentheses.','Continue with linked-list reversal, tree traversals, islands and coin change.','Compare brute force with optimized approaches and test edge cases.'],exclude:['Database','Pandas','JavaScript','Shell','Concurrency','Segment Tree','Binary Indexed Tree']},
  {id:'top',code:'03',title:'Top-Tier Product Companies',subtitle:'Go deeper into problem solving',difficulty:['Medium','Hard'],groupIds:['core','arrays','strings','search-sort','hashing','lists','stack-queue','two-pointers','sliding-window','prefix','intervals','trees','graphs','heap','greedy','backtracking','dp','shortest-path','topological','union-find','trie','range','bits','design'],pdf:'DSA_03_Top_Tier_Product_Companies.pdf',companies:['Google','Meta','Amazon','Microsoft','Apple','Netflix','Adobe','Uber','Salesforce','LinkedIn','Atlassian','Sprinklr','X (Twitter)','Texas Instruments'],focus:'Medium to Hard · correctness, trade-offs and depth',tips:['Practise word break, course schedule, LRU cache and longest increasing subsequence.','Study shortest paths, trie search, union-find and grid DP.','Explain correctness, alternative approaches, complexity and trade-offs.'],exclude:['Database','Pandas','JavaScript','Shell','Concurrency']}
 ],
 normalize(value){return String(value).toLowerCase().replace(/[^a-z0-9]/g,'');},
 level(id){return this.levels.find(l=>l.id===id)||this.levels[0];},
 topics(item,level){const tags=new Set((item.topics||[]).map(t=>this.normalize(t)));return this.groups.filter(g=>level.groupIds.includes(g.id)&&(g.tags.some(t=>tags.has(this.normalize(t)))||g.hint?.test(item.title)));},
 build(items){return new Map(this.levels.map(level=>{const excluded=new Set(level.exclude.map(t=>this.normalize(t)));const rows=items.filter(p=>level.difficulty.includes(p.difficulty)&&!(p.topics||[]).some(t=>excluded.has(this.normalize(t)))).map(p=>({...p,levelTopics:this.topics(p,level)})).filter(p=>p.levelTopics.length);return [level.id,rows];}));}
};
