---
title: 杂记 Static Program Analyses
date: 2025/03/12 12:35
tags: ["程序分析","开发"]
category: 乱写的
---

# Program Representation
## Basic Block

flow -> "Basic block" -> out

- a basic block has only one entry point and one exit point.
- no inside jump
- never jump to middle
- control can always leaves successfully, only exception is last instruction

### leader
first instruction

- first instruction of program
- target of a jump
- instruction immediately run after a jump

## Directed Acyclic Graphs
DAG-Based Optimization. <- Local optimization.

- Node = input value of basic block, associated with instruction inside basic block
- instruction S uses `var defined in` S1,...Sn -> edge of `Si to S`
- `var` defined but not used inside its def-basic-block, mark it to *output value*

```
1: a = b + c
2: b = a - d
3: c = b + c
4: d = a - d
```

DAG:

```
in b,c -> out (+,a)
in a,d -> out (-,b)
...
```
### Optimize
- `Hashmap<Pair<Function,Node>>.existed` -> v' = alias of v
- to Value-Number table
  `Pair<Instruction, Pair<Function, List<Node>>>`
  ```
    1 (b) to (in,_)
    ...
    4 (b = d - a) to (-, 3, 4) // 3 is nodeId
    ...
    7 (d = d - a) to (-, 3, 4)
  ```
  - same number(4,7) = dup!

Dead code elimination can be made!