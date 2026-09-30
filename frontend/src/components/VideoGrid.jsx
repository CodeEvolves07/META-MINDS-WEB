import React, { useRef, useEffect, useState } from "react";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  Wifi, 
  MessageSquare, 
  Send, 
  User, 
  ShieldCheck, 
  UserCheck, 
  Volume2,
  Minimize2,
  Maximize2
} from "lucide-react";

export function VideoGrid({
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  networkQuality,
  role,
  username,
  remotePeerInfo,
  chatMessages = [],
  onSendChat
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [activeTab, setActiveTab] = useState("video"); // 'video' | 'chat'
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef(null);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-scroll chat
  useEffect(() => {
    if (activeTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, activeTab]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput("");
  };

  const getQualityBadge = () => {
    if (!networkQuality) return { text: "<50ms P2P", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    const { rtt } = networkQuality;
    if (rtt < 80) return { text: `${rtt}ms • Excellent`, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    if (rtt < 150) return { text: `${rtt}ms • Good`, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    return { text: `${rtt}ms • Fair`, color: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
  };

  const quality = getQualityBadge();

  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-800 select-none">
      {/* Top Header / Tab Switcher */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-slate-800 bg-slate-950 text-xs">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab("video")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "video" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>WebRTC Call</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "chat" ? "bg-slate-800 text-blue-400" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
            {chatMessages.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-blue-600 text-[10px] text-white flex items-center justify-center font-bold">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>

        {/* Network Quality Indicator */}
        <div className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${quality.color}`}>
          <Wifi className="w-3 h-3" />
          <span>{quality.text}</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "video" ? (
          <div className="h-full flex flex-col p-3 space-y-3 justify-between">
            {/* Remote Peer Video Tile (Large) */}
            <div className="flex-1 relative rounded-xl bg-slate-950 overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-400 font-medium">
                    Waiting for {role === "interviewer" ? "Candidate" : "Interviewer"} to join...
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Share the invite link to initiate P2P WebRTC audio/video handshake (&lt;100ms latency).
                  </p>
                </div>
              )}

              {/* Remote Peer Label */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-slate-200 flex items-center gap-1.5">
                {remotePeerInfo?.role === "interviewer" ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>{remotePeerInfo?.username || (role === "interviewer" ? "Candidate" : "Interviewer")}</span>
              </div>
            </div>

            {/* Local Video Tile (Floating / Sub-pane) */}
            <div className="h-36 relative rounded-xl bg-slate-950 overflow-hidden border border-slate-800 shadow-md flex items-center justify-center">
              {isVideoOff ? (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-1">
                  <VideoOff className="w-6 h-6 stroke-1 text-slate-600" />
                  <span className="text-[11px]">Camera Muted</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )}

              {/* Local Self Badge */}
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-slate-200 flex items-center gap-1">
                <span>You ({role === "interviewer" ? "Interviewer" : "Candidate"})</span>
                {isMuted && <MicOff className="w-3 h-3 text-rose-400 ml-1" />}
              </div>

              {/* Audio Wave Meter */}
              {!isMuted && (
                <div className="absolute bottom-2 right-2 flex items-center space-x-0.5 px-1.5 py-1 rounded bg-black/60">
                  <div className="w-1 h-3 bg-emerald-400 rounded-full audio-bar" style={{ animationDelay: '0ms' }} />
                  <div className="w-1 h-4 bg-emerald-400 rounded-full audio-bar" style={{ animationDelay: '100ms' }} />
                  <div className="w-1 h-2 bg-emerald-400 rounded-full audio-bar" style={{ animationDelay: '200ms' }} />
                </div>
              )}
            </div>

            {/* In-Call Media Action Controls */}
            <div className="flex items-center justify-center space-x-2 pt-1">
              {/* Mic Toggle */}
              <button
                onClick={onToggleMic}
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                className={`p-2.5 rounded-full transition-all shadow-md ${
                  isMuted
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Camera Toggle */}
              <button
                onClick={onToggleVideo}
                title={isVideoOff ? "Turn On Camera" : "Turn Off Camera"}
                className={`p-2.5 rounded-full transition-all shadow-md ${
                  isVideoOff
                    ? "bg-rose-600 hover:bg-rose-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                }`}
              >
                {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              </button>

              {/* Screen Share Toggle */}
              <button
                onClick={onToggleScreenShare}
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                className={`p-2.5 rounded-full transition-all shadow-md ${
                  isScreenSharing
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                }`}
              >
                <MonitorUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Live Chat Room Tab */
          <div className="h-full flex flex-col justify-between p-3">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-1">
                  <MessageSquare className="w-6 h-6 stroke-1 text-slate-600" />
                  <p className="text-xs">No chat messages yet.</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMe = msg.sender === username;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="text-[10px] text-slate-500 mb-0.5 px-1 flex items-center gap-1 font-mono">
                        <span>{msg.sender}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-xl max-w-[85%] break-words ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-none shadow-sm"
                            : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="pt-2 flex items-center gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-950 text-xs px-3 py-2 rounded-lg border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
