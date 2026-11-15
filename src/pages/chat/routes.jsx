// Chat routes, mounted under /chat by App.jsx. Owned by the chat area.
// Expected: index → conversation list, ':conversationId' → conversation.
export const chatRoutes = [
  { index: true, element: <p>Chats</p> },
  { path: ':conversationId', element: <p>Conversation</p> },
];
