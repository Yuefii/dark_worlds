import { useEffect, useRef, useState } from "react";
import { supabase } from "../libs/supabase";
import { handleCommand } from "../hooks/useCommands";

type User = {
  username: string;
  password: string;
  online: boolean;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [discussionMessages, setDiscussionMessages] = useState<any[]>([]);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [showOnlineUser, setShowOnlineUser] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setCurrentUser(storedUser);
      supabase
        .from('users')
        .update({ online: true })
        .eq('username', storedUser);
    }

    const channel = supabase
      .channel('online-users')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, payload => {
        fetchOnlineUsers();
      })
      .subscribe();

    fetchOnlineUsers();
    fetchDiscussionMessages();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOnlineUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('online', true);

    if (data) {
      setOnlineUsers(data);
    }
  };

  const fetchDiscussionMessages = async () => {
    const { data, error } = await supabase
      .from('community_discussion_messages')
      .select('*')
      .order('sent_at', { ascending: false });

    if (data) {
      setDiscussionMessages(data);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const args = input.trim().split(" ");
      const command = args[0];
      const commandArgs = args.slice(1);
      
      await handleCommand(
        command,
        commandArgs,
        currentUser,
        setCurrentUser,
        setOutput,
        setInput,
        setShowDiscussion,
        setShowOnlineUser,
        fetchOnlineUsers,
        fetchDiscussionMessages
      );
    }
  };

  return (
    <main className="max-w-4xl mx-auto bg-black rounded">
      <div className="p-5 h-[500px] overflow-auto">
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex gap-2"
        >
          <h1 className="text-white">⤷</h1>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-none outline-none bg-transparent text-white m-0 p-0"
            type="text"
          />
        </div>
        <div className="text-white whitespace-pre-line">
          <pre>
            {output}
          </pre>
        </div>
        {showDiscussion && (
          <div className="text-white mt-4">
            <h2>Community Discussion:</h2>
            <ul>
              {discussionMessages.map((message, index) => (
                <li key={index}>{message.sender_username}: {message.content}</li>
              ))}
            </ul>
          </div>
        )}
        {showOnlineUser && (
          <div className="text-white mt-4">
            <h2>Online Users:</h2>
            <ul>
              {onlineUsers.map(user => (
                <li key={user.username}>{user.username}</li>
              ))}
            </ul>
          </div>
        )
        }
      </div>
    </main>
  );
}
