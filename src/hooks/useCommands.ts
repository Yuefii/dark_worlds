import { supabase } from "../libs/supabase";
import { Dispatch, SetStateAction } from "react";

export const handleCommand = async (
    command: string,
    args: string[],
    currentUser: string | null,
    setCurrentUser: Dispatch<SetStateAction<string | null>>,
    setOutput: Dispatch<SetStateAction<string>>,
    setInput: Dispatch<SetStateAction<string>>,
    setShowDiscussion: Dispatch<SetStateAction<boolean>>,
    setShowOnlineUser: Dispatch<SetStateAction<boolean>>,
    fetchOnlineUsers: () => Promise<void>,
    fetchDiscussionMessages: () => Promise<void>
) => {
    let newOutput = "";

    switch (command) {
        case "whoami":
            newOutput = `${currentUser ? currentUser : "Not logged in"}`;
            break;
        case "clear":
            setOutput("");
            setInput("");
            return;
        case "register":
            if (args.length < 2) {
                newOutput = `Usage: register <username> <password>`;
            } else {
                const [username, password] = args;
                const { data, error } = await supabase
                    .from('users')
                    .insert([{ username, password }]);
                if (error) {
                    newOutput = `Error: ${error.message}`;
                } else {
                    newOutput = `User ${username} registered successfully`;
                }
            }
            break;
        case "login":
            if (args.length < 2) {
                newOutput = `Usage: login <username> <password>`;
            } else {
                const [username, password] = args;
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('username', username)
                    .eq('password', password)
                    .single();
                if (error || !data) {
                    newOutput = `Invalid username or password`;
                } else {
                    setCurrentUser(username);
                    localStorage.setItem("currentUser", username);
                    await supabase
                        .from('users')
                        .update({ online: true })
                        .eq('username', username);
                    newOutput = `User ${username} logged in successfully`;
                    fetchOnlineUsers();
                }
            }
            break;
        case "logout":
            if (!currentUser) {
                newOutput = `You need to be logged in to log out`;
            } else {
                await supabase
                    .from('users')
                    .update({ online: false })
                    .eq('username', currentUser);
                setCurrentUser(null);
                localStorage.removeItem("currentUser");
                newOutput = `User logged out successfully`;
                fetchOnlineUsers();
            }
            break;
        case "inbox":
            if (!currentUser) {
                newOutput = `You need to log in to view your inbox`;
            } else {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('recipient', currentUser);
                if (error || !data) {
                    newOutput = `Error: ${error.message}`;
                } else if (data.length === 0) {
                    newOutput = `No new messages`;
                } else {
                    newOutput = `Inbox:\n`;
                    data.forEach((message: any, index: number) => {
                        newOutput += `${index + 1}. From ${message.sender}: ${message.content}\n`;
                    });
                }
            }
            break;
        case "send":
            if (!currentUser) {
                newOutput = `You need to log in to send messages`;
            } else if (args.length < 2) {
                newOutput = `Usage: send <recipient> <message>`;
            } else {
                const [recipient, ...messageParts] = args;
                const message = messageParts.join(" ");
                const { data, error } = await supabase
                    .from('messages')
                    .insert([{ sender: currentUser, recipient, content: message }]);
                if (error) {
                    newOutput = `Error: ${error.message}`;
                } else {
                    newOutput = `Message sent to ${recipient}`;
                }
            }
            break;
        case "discussion":
            if (!currentUser) {
                newOutput = `You need to log in to join the discussion`;
            } else if (args.length === 0) {
                newOutput = `Usage: discussion <message>`;
            } else {
                const message = args.join(" ");
                const { data, error } = await supabase
                    .from('community_discussion_messages')
                    .insert([{ sender_username: currentUser, content: message }]);
                if (error) {
                    newOutput = `Error: ${error.message}`;
                } else {
                    newOutput = `Message posted to community discussion`;
                    fetchDiscussionMessages();
                }
            }
            break;
        case "show":
            if (args[0] === "discussion") {
                setShowDiscussion(true);
                console.log("Community discussion is now visible");
            } else if (args[0] === "users") {
                setShowOnlineUser(true)
                console.log("Users Online is now visible");
            } else {
                console.log("Command not recognized");
            }
            break;

        case "hide":
            if (args[0] === "discussion") {
                setShowDiscussion(false);
                console.log("Community discussion is now hidden");
            } else if (args[0] === "users") {
                setShowOnlineUser(false)
                console.log("Users Online is now hidden");
            } else {
                console.log("Command not recognized");
            }
            break;
        case "help":
            newOutput = `Available Commands:\n`;
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
            newOutput = `-------------------------------------------------------------------\n`;
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
            newOutput = `Command not found please using "help"`;
    }

    setOutput(prevOutput => prevOutput + `\n⤷ ${command} ${args.join(" ")}\n${newOutput}`);
    setInput("");
};
