# Demo script

About five minutes. Start both servers (see README), then open http://localhost:3000 in two browser windows, one of them private or incognito.

## 1. Set up (window A)

1. Create the first account. It becomes the admin.
2. On the Ask page, choose **Add sample documents**. Six policies are indexed; "Confidential Executive Strategy and Compensation" is set to *Only me*.

## 2. Grounded answers

Ask **"How long do I have to submit expense reports?"**

- The answer cites source 1. The source panel opens with the supporting sentence highlighted.
- Follow up with **"What about receipts?"** The question is resolved against the conversation and the answer quotes the $25 receipt rule.
- Choose **Open document** to see the passage in context.

## 3. Declining instead of guessing

Ask **"Who is the CEO?"** or **"What was revenue in 2023?"** The assistant says the documents don't cover it rather than inventing an answer.

## 4. Access control (window B)

1. In the second window, create a member account.
2. Ask **"How much sabbatical leave do senior executives get?"** The member gets *Not found in your documents*, and the private document doesn't appear under Documents or Search.
3. Back in window A, ask the same question as admin: "45 days", cited.
4. Optional: in window A, open the confidential document, choose **Change access**, then **Specific people**, and pick the member. The member can now ask about it. Set it back to *Only me* and access is revoked immediately.

## 5. Answer quality

In window A, open **Answer quality** and choose **Run benchmark**. 31 questions cover direct facts, paraphrases, multi-document questions, missing evidence, and restricted documents asked as a member. Expand any row to see the answer, citations and retrieved documents. The restricted-leak count should be 0.

With a `GEMINI_API_KEY` set, answers are written by Gemini (and multi-document questions pass); without one, they're quoted directly.
