import { useEffect, useRef, useState } from "react";
import { supabase } from "../libs/supabase";

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
      let newOutput = output;
      const args = input.trim().split(" ");
      const command = args[0];
      const commandArgs = args.slice(1);

      switch (command) {
        case "whoami":
          newOutput += `\n$ ${input}\n${currentUser ? currentUser : "Not logged in"}`;
          break;
        case "clear":
          newOutput = "";
          break;
        case "register":
          if (commandArgs.length < 2) {
            newOutput += `\n$ ${input}\nUsage: register <username> <password>`;
          } else {
            const [username, password] = commandArgs;
            const { data, error } = await supabase
              .from('users')
              .insert([{ username, password }]);
            if (error) {
              newOutput += `\n$ ${input}\nError: ${error.message}`;
            } else {
              newOutput += `\n$ ${input}\nUser ${username} registered successfully`;
            }
          }
          break;
        case "login":
          if (commandArgs.length < 2) {
            newOutput += `\n$ ${input}\nUsage: login <username> <password>`;
          } else {
            const [username, password] = commandArgs;
            const { data, error } = await supabase
              .from('users')
              .select('*')
              .eq('username', username)
              .eq('password', password)
              .single();
            if (error || !data) {
              newOutput += `\n$ ${input}\nInvalid username or password`;
            } else {
              setCurrentUser(username);
              localStorage.setItem("currentUser", username);
              await supabase
                .from('users')
                .update({ online: true })
                .eq('username', username);
              newOutput += `\n$ ${input}\nUser ${username} logged in successfully`;
              fetchOnlineUsers();
            }
          }
          break;
        case "logout":
          if (!currentUser) {
            newOutput += `\n$ ${input}\nYou need to be logged in to log out`;
          } else {
            await supabase
              .from('users')
              .update({ online: false })
              .eq('username', currentUser);
            setCurrentUser(null);
            localStorage.removeItem("currentUser");
            newOutput += `\n$ ${input}\nUser logged out successfully`;
            fetchOnlineUsers();
          }
          break;
        case "send":
          if (!currentUser) {
            newOutput += `\n$ ${input}\nYou need to log in to send messages`;
          } else if (commandArgs.length < 2) {
            newOutput += `\n$ ${input}\nUsage: send <recipient> <message>`;
          } else {
            const [recipient, ...messageParts] = commandArgs;
            const message = messageParts.join(" ");
            const { data, error } = await supabase
              .from('messages')
              .insert([{ sender: currentUser, recipient, content: message }]);
            if (error) {
              newOutput += `\n$ ${input}\nError: ${error.message}`;
            } else {
              newOutput += `\n$ ${input}\nMessage sent to ${recipient}`;
            }
          }
          break;
        case "discussion":
          if (!currentUser) {
            newOutput += `\n$ ${input}\nYou need to log in to join the discussion`;
          } else if (commandArgs.length === 0) {
            newOutput += `\n$ ${input}\nUsage: discussion <message>`;
          } else {
            const message = commandArgs.join(" ");
            const { data, error } = await supabase
              .from('community_discussion_messages')
              .insert([{ sender_username: currentUser, content: message }]);
            if (error) {
              newOutput += `\n$ ${input}\nError: ${error.message}`;
            } else {
              newOutput += `\n$ ${input}\nMessage posted to community discussion`;
              fetchDiscussionMessages();
            }
          }
          break;
        default:
          newOutput += `\n$ ${input}\nCommand not found`;
      }

      setOutput(newOutput);
      setInput("");
    }
  };

  return (
    <main className="max-w-4xl mx-auto bg-black rounded">
      <div className="my-40 p-5 h-[500px] overflow-auto">
        <div
          onClick={() => inputRef.current?.focus()}
          className="flex gap-2"
        >
          <h1 className="text-white">$</h1>
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
          {output}
        </div>
        <div className="text-white mt-4">
          <h2>Community Discussion:</h2>
          <ul>
            {discussionMessages.map((message, index) => (
              <li key={index}>{message.sender_username}: {message.content}</li>
            ))}
          </ul>
        </div>
        <div className="text-white mt-4">
          <h2>Online Users:</h2>
          <ul>
            {onlineUsers.map(user => (
              <li key={user.username}>{user.username}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
