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
        case "inbox":
          if (!currentUser) {
            newOutput += `\n$ ${input}\nYou need to log in to view your inbox`;
          } else {
            const { data, error } = await supabase
              .from('messages')
              .select('*')
              .eq('recipient', currentUser);
            if (error || !data) {
              newOutput += `\n$ ${input}\nError: ${error.message}`;
            } else if (data.length === 0) {
              newOutput += `\n$ ${input}\nNo new messages`;
            } else {
              newOutput += `\n$ ${input}\nInbox:\n`;
              data.forEach((message: any, index: number) => {
                newOutput += `${index + 1}. From ${message.sender}: ${message.content}\n`;
              });
            }
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
        case "show":
          if (commandArgs[0] === "discussion") {
            setShowDiscussion(true);
            console.log("Community discussion is now visible");
          } else if (commandArgs[0] === "users") {
            setShowOnlineUser(true)
            console.log("Users Online is now visible");
          } else {
            console.log("Command not recognized");
          }
          break;

        case "hide":
          if (commandArgs[0] === "discussion") {
            setShowDiscussion(false);
            console.log("Community discussion is now hidden");
          } else if (commandArgs[0] === "users") {
            setShowOnlineUser(false)
            console.log("Users Online is now hidden");
          } else {
            console.log("Command not recognized");
          }
          break;
        case "help":
          newOutput += `\n$ ${input}\nAvailable Commands:\n`;
          newOutput += `-------------------------------------------------------------------\n`;
          newOutput += `whoami                         - Display current user\n`;
          newOutput += `clear                          - Clear screen\n`;
          newOutput += `register <username> <password> - Register a new user\n`;
          newOutput += `login <username> <password>    - Log in as a user\n`;
          newOutput += `logout                         - Log out from current user\n`;
          newOutput += `send <recipient> <message>     - Send a message to another user\n`;
          newOutput += `discussion <message>           - Post a message to community discussion\n`;
          newOutput += `help                           - Show available commands\n`;
          newOutput += `-------------------------------------------------------------------\n`;
          break;
        case "about":
          newOutput += `-------------------------------------------------------------------\n`;
          newOutput += `  ____             _                         _     _     \n`;
          newOutput += ` |  _ \\  __ _ _ __| | __ __      _____  _ __| | __| |___ \n`;
          newOutput += ` | | | |/ _\` | '__| |/ / \\ \\ /\\ / / _ \\| '__| |/ _\` / __|\n`;
          newOutput += ` | |_| | (_| | |  |   <   \\ V  V / (_) | |  | | (_| \\__ \\ \n`;
          newOutput += ` |____/ \\__,_|_|  |_|\\_\\   \\_/\\_/ \\___/|_|  |_|\\__,_|___/ \n`;
          newOutput += `                                                         \n`;
          newOutput += `-------------------------------------------------------------------\n`;
          newOutput += `Show available commands using "help"                               \n`;
          newOutput += `This web created by Yuefii                                         \n`;
          break;
        default:
          newOutput += `\n$ ${input}\nCommand not found please using "help"`;
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
