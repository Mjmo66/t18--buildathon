// Chat routes, mounted under /chat by App.jsx. Owned by the chat area.
import ConversationList from './ConversationList.jsx';
import Conversation from './Conversation.jsx';

export const chatRoutes = [
  { index: true, element: <ConversationList /> },
  { path: ':conversationId', element: <Conversation /> },
];
