import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MdArrowBack as ArrowBackIcon } from "react-icons/md";
import { MdAttachFile as AttachIcon } from "react-icons/md";
import { MdClose as CloseIcon } from "react-icons/md";
import { useUserdatacontext } from "../service/context/usercontext";
import {
  useConversations,
  useConversation,
  useUserByUsername,
  useSendMessage,
  useMarkConversationAsRead,
} from "../hooks/queries";
import { uploadMessageAttachment } from "../service/Auth/database";
import Avatar from "../ui/avatar";
import Time from "../service/utiles/time";

export default function Messages() {
  const { userdata, defaultprofileimage, refreshUnreadMessageCount } = useUserdatacontext();
  const navigate = useNavigate();
  const { username } = useParams();
  const [inputText, setInputText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const { data: conversations = [] } = useConversations(userdata?.uid);
  const { data: otherUser } = useUserByUsername(username);
  const { data: messages = [] } = useConversation(
    userdata?.uid,
    otherUser?.uid,
    { enabled: !!(userdata?.uid && otherUser?.uid) }
  );
  const sendMessageMutation = useSendMessage();
  const markReadMutation = useMarkConversationAsRead();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    if (otherUser?.uid && userdata?.uid) {
      markReadMutation.mutate({ myUid: userdata.uid, otherUid: otherUser.uid });
      refreshUnreadMessageCount?.();
    }
  }, [otherUser?.uid, userdata?.uid]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files].slice(-6));
    e.target.value = "";
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    const hasText = !!inputText.trim();
    const hasFiles = pendingFiles.length > 0;
    if (!otherUser?.uid || (!hasText && !hasFiles) || sendMessageMutation.isPending || uploading) return;

    setUploading(true);
    let attachments = [];
    try {
      if (pendingFiles.length > 0) {
        attachments = await Promise.all(
          pendingFiles.map((file) => uploadMessageAttachment(file, userdata.uid))
        );
        attachments = attachments.filter(Boolean);
        setPendingFiles([]);
      }
      const text = inputText.trim();
      setInputText("");
      await sendMessageMutation.mutateAsync({
        fromUid: userdata.uid,
        toUid: otherUser.uid,
        text,
        attachments: attachments.length ? attachments : undefined,
      });
    } finally {
      setUploading(false);
    }
  };

  const startConversation = (profile) => {
    navigate(`/messages/${profile?.username}`);
  };

  if (!userdata?.uid) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-text-secondary">Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Messages | Accel Net</title>
      </Helmet>

      <div className="flex flex-col min-h-screen h-screen w-full -mt-10 -pt-8 -mx-4 pr-4">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-bg-default/80 backdrop-blur-xl border-b border-border-default flex-shrink-0">
          <div className="flex items-center gap-4 h-[53px] px-4">
            <button
              onClick={() => navigate("/home")}
              className="p-2 rounded-full hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowBackIcon className="text-xl" />
            </button>
            <h1 className="text-xl font-bold text-text-primary">Messages</h1>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-row">
          {/* Conversation list (left) - hidden on narrow when viewing chat */}
          <div
            className={`${
              username ? "hidden md:flex" : "flex"
            } flex-col w-full md:w-80 flex-shrink-0 border-r border-border-default overflow-hidden order-1`}
          >
            {conversations.length === 0 && !username ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-text-secondary text-[15px]">No messages yet</p>
                <p className="text-text-tertiary text-[13px] mt-2">
                  Start a conversation from someone's profile
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1">
                {conversations.map((c) => (
                  <button
                    key={c.otherUid}
                    type="button"
                    onClick={() => startConversation(c.profile)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-left border-b border-border-default ${
                      c.profile?.username === username ? "bg-bg-hover" : ""
                    }`}
                  >
                    <Avatar
                      src={c.profile?.profileImageURL}
                      alt={c.profile?.name}
                      size="md"
                      fallback={defaultprofileimage}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[15px] text-text-primary truncate">
                          {c.profile?.name || c.profile?.username || "Unknown"}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent-500 text-white text-xs font-bold">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-text-tertiary truncate">
                        @{c.profile?.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active chat (right) */}
          <div
            className={`${
              username ? "flex" : "hidden md:flex"
            } flex-col flex-1 min-w-0 order-2`}
          >
            {username && otherUser ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default bg-bg-tertiary/50">
                  <button
                    type="button"
                    onClick={() => navigate("/messages")}
                    className="md:hidden p-2 -ml-2 rounded-full hover:bg-bg-hover"
                  >
                    <ArrowBackIcon className="text-xl" />
                  </button>
                  <Avatar
                    src={otherUser.profileImageURL}
                    alt={otherUser.name}
                    size="md"
                    fallback={defaultprofileimage}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] text-text-primary truncate">
                      {otherUser.name || otherUser.username}
                    </p>
                    <p className="text-[13px] text-text-tertiary">@{otherUser.username}</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => {
                    const isMe = m.fromUid === userdata.uid;
                    const attachments = Array.isArray(m.attachments) ? m.attachments : [];
                    return (
                      <div
                        key={m.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            isMe
                              ? "bg-accent-500 text-white"
                              : "bg-bg-tertiary border border-border-default text-text-primary"
                          }`}
                        >
                          {attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mb-2">
                              {attachments.map((att, i) =>
                                att.type === "image" ? (
                                  <a
                                    key={i}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-lg overflow-hidden max-w-full"
                                  >
                                    <img
                                      src={att.url}
                                      alt={att.name || "Image"}
                                      className="max-h-48 w-auto object-contain rounded-lg"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    key={i}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-[13px] underline truncate max-w-[200px] ${
                                      isMe ? "text-white/90" : "text-accent-500"
                                    }`}
                                    title={att.name}
                                  >
                                    📎 {att.name || "File"}
                                  </a>
                                )
                              )}
                            </div>
                          )}
                          {m.text ? (
                            <p className="text-[15px] break-words">{m.text}</p>
                          ) : null}
                          <p
                            className={`text-[11px] mt-1 ${
                              isMe ? "text-white/80" : "text-text-tertiary"
                            }`}
                          >
                            {Time(
                              m.createdAt?.seconds ??
                                (m.createdAt instanceof Date
                                  ? Math.floor(m.createdAt.getTime() / 1000)
                                  : 0)
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form
                  onSubmit={handleSend}
                  className="flex flex-col gap-2 p-4 border-t border-border-default bg-bg-default"
                >
                  {pendingFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      {pendingFiles.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-tertiary border border-border-default text-text-secondary text-[13px]"
                        >
                          <span className="truncate max-w-[120px]" title={file.name}>
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePendingFile(i)}
                            className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary"
                            aria-label="Remove"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-full bg-bg-tertiary border border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                      title="Add attachment"
                      aria-label="Add attachment"
                    >
                      <AttachIcon className="text-xl" />
                    </button>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1 px-4 py-3 rounded-full bg-bg-tertiary border border-border-default text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-500 text-[15px]"
                    />
                    <button
                      type="submit"
                      disabled={
                        (!inputText.trim() && pendingFiles.length === 0) ||
                        sendMessageMutation.isPending ||
                        uploading
                      }
                      className="px-5 py-3 rounded-full bg-accent-500 text-white font-semibold hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {uploading ? "…" : "Send"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <p className="text-text-secondary text-[15px]">Select a conversation</p>
                <p className="text-text-tertiary text-[13px] mt-2">
                  Or visit a profile and message them
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
