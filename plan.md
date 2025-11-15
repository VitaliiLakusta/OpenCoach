Implement the next thing. Do not move to the next point until the previous is fully implemented and I confirm it. When the task is marked as [DONE] in the beginning, consider it done and proceed with the next one.

1. [DONE] Implement the feature where agent is aware of the files that it loads in memory. And implement this use-case, based on the example below: 
I chat with agent in UI and ask it, "Add it to my TODO list for today to exercise and go to the gym"
Agent should be aware and find the most relevant note for today (could be the most recent file), and add a todo list to exercise in that note.
2. [DONE] Enable notifications. I want to notify the user with the notification when they go to the chat. For now, let's just test "hello world" with notifications.

3. I want to have an engine to create reminders (notifications). This is how it's going to work: 
  a) You need to check CONTEXT.md every minute. Only if it's changed (file modified), we proceed further with next steps. 
  b) Based on my CONTEXT file, parse the list using LLM call of reminders in the following json schema (providing example below). 
  c) schema based on example:
  ```json
    {
        reminders: [
            {
                "dateTime": "2025-11-16T09:00:00",
                "reminderText": "Reflect on exercising"
            },
            {
                "dateTime": "2025-11-16T18:00:00",
                "reminderText": "Reflect in the evening"
            }
        ]
    }
  ```
  d) Save the result into state.json file (feel free to create it if not existing at the root of the project). Append it like this: 
  ```json
    "reminders": "<reminders structure goes here>"
  ```

  e) Also persist the time when you ran it into `state.json` with the field "lastRun". 

  f) For debugging purposes, please log your actions so I can observe when you do runs and what happens.