#!/usr/bin/env python3
"""Approximate token count of a file (chars/4). The skill body is a context tax
paid on every trigger, including false ones, so its static size is the cost
number that matters most; run-time deltas are second order."""
import sys
text = open(sys.argv[1], encoding="utf-8").read()
print(round(len(text) / 4))
