# Reflection

**Name / Andrew ID:** Mira Thope / mthope

**Recitation group members (Task 2):** Our TA used up all of recitation to do Task 1, so we didn't get a chance to split into groups. I worked on Task 2 individually. 

---

### 1. Valid but weak

Pick a property you wrote that passes on the correct implementation but
kills few or no mutants. Why is it still a *valid* property? Describe a
concrete bug (not one of our mutants) that it *would* catch.

My "returns exactly five colors" invariant doesn't kill any of the public mutants. That makes sense, since all of them still return five colors; they just get the colors wrong. It's still a valid property, though, because the spec says the result has one color per letter of the guess, so it'll never fail on correct code. It just isn't checking anything the mutants mess up. It would catch something like an off-by-one loop (i <= 5 instead of i < 5) that adds a sixth color, or code that returns early and gives back fewer than five colors when it hits a weird case like duplicate letters.

### 2. A generator problem, not a property problem

Describe a mutant, from either task, that survived or was flaky because of
your **generator** rather than your property. What did the generator fail to
produce? How did you fix it? Paste the runner output from before and after.

singlePass was flaky for me. It was only killed in 4 out of 5 runs, by my "never credits a letter more times than the secret contains it" property. The property itself was fine; the issue was my generator. I was making words from all 26 letters, and random words like that almost never repeat a letter, but this bug only shows up when the guess has the same letter more than once. So most of the time the generator just never gave it an input that could expose the bug. To fix it, I ran that property on words made only from A and B (wordFrom('AB')), so almost every word has repeats. After that, singlePass got killed every run.

**Before:**
```
> pbt-fast-check@1.0.0 mutants:wordle
> tsx scripts/mutants.ts wordle


Checking test/wordle.test.ts against the correct implementation (5 runs)...
  ✔ all 4 test(s) pass

Running against 5 mutants (5 runs each)...

  ✔ allBlack       killed  by: guessing the secret gives all greens
      Counterexample: ["AAAAA"]
      AssertionError: expected [ 'B', 'B', 'B', 'B', 'B' ] to deeply equal [ 'G', 'G', 'G', 'G', 'G' ]
  ✘ greensOnly     SURVIVED
  ✔ ignoresCounts  killed  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAAWA","WAAWA"]
      AssertionError: expected 2 to be less than or equal to 1
  ~ singlePass     flaky: killed in 4/5 runs  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAADA","ADADA"]
      AssertionError: expected 2 to be less than or equal to 1
  ✔ swapped        killed  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAAZA","ZAAXA"]
      AssertionError: expected 1 to be less than or equal to 0

Mutation score: 3/5 killed (60%)
```
**After:**
```
> pbt-fast-check@1.0.0 mutants:wordle
> tsx scripts/mutants.ts wordle


Checking test/wordle.test.ts against the correct implementation (5 runs)...
  ✔ all 8 test(s) pass

Running against 5 mutants (5 runs each)...

  ✔ allBlack       killed  by: guessing the secret gives all greens; is green exactly where the letters match; a rotated secret with distinct letters gives all yellows
      Counterexample: ["AAAAA"]
      AssertionError: expected [ 'B', 'B', 'B', 'B', 'B' ] to deeply equal [ 'G', 'G', 'G', 'G', 'G' ]
  ✔ greensOnly     killed  by: a rotated secret with distinct letters gives all yellows
      Counterexample: [{"secret":"JEOHP","guess":"EOHPJ"}]
      AssertionError: expected [ 'B', 'B', 'B', 'B', 'B' ] to deeply equal [ 'Y', 'Y', 'Y', 'Y', 'Y' ]
  ✔ ignoresCounts  killed  by: never credits a letter more times than the secret contains it
      Counterexample: ["AAABA","AAABB"]
      AssertionError: expected 2 to be less than or equal to 1
  ✔ singlePass     killed  by: never credits a letter more times than the secret contains it
      Counterexample: ["AABAA","AAAAA"]
      AssertionError: expected 5 to be less than or equal to 4
  ✔ swapped        killed  by: colors letters missing from the secret black
      Counterexample: ["ANAAA","AONAA"]
      AssertionError: expected 'Y' to be 'B' // Object.is equality

Mutation score: 5/5 killed (100%)
```

### 3. Reading a counterexample

Paste one counterexample that the mutation runner printed for a killed
mutant. In 2–3 sentences, explain using the *specification* why that input
exposes the bug.

```
  ✔ touchingNotMerged       killed  by: returns sorted, separated intervals; gives the same result for any order of the input
      Counterexample: [[[-7,-1],[-1,-1]]]
      AssertionError: expected -1 to be less than -1
```

The intervals are closed, so [-7,-1] and [-1,-1] both include -1, which means they touch. The spec says touching intervals have to merge (consecutive output intervals need result[i][1] < result[i + 1][0]), so the right answer is just [-7,-1]. The mutant didn't merge them, so the output had one interval ending at -1 right before one starting at -1, and -1 < -1 is false, so my test failed.

### 4. Your project

Name one function or module in your team's project that would benefit from
property-based testing. State two properties in English, name the pattern of
each, and describe the generator you'd need, including anything about its
inputs that a naive generator would get wrong.

Function: I'd pick Git.Service.log() from our opencode project. I wrote it for the commit-summary feature. It runs git log and parses the output into commit objects with the hash, author, email, date, message, and changed files.

Property 1 (pattern: round trip): If I generate a commit history, actually make those commits in a temp repo, and then call log(), I should get the same commits back: same number of commits, and each one has the same author, email, message, and changed files that I put in.

Property 2 (pattern: invariant): For a history with N commits, asking for n commits (n ≥ 1) should give exactly min(n, N) commits, newest first. Also, asking for fewer commits should give a prefix of what you get when asking for more.

Generator: The generator has to build a whole commit history (a few commits, each with an author, email, message, and file changes) and then create it in a temp repo every run. Just using random strings would miss most of the tricky cases:

- The parser splits fields on the \x1f character and splits commits on blank lines. Random strings basically never include those, so the generator needs to put \x1f and blank lines into commit messages on purpose.
- Git cleans up messages: it strips blank lines at the start and end and trailing spaces, and it won't accept an empty message. So the generator either has to make messages git won't change, or the test has to compare against the cleaned-up version.
- File paths can have spaces, tabs, quotes, or non-ASCII characters, and files can be renamed or binary. All of those change how git reports them, so the generator should include some.
- If two commits happen in the same second, their order can come back ambiguous, so each commit should get its own explicit date that increases.