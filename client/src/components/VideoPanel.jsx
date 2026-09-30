import React, { useRef, useEffect } from 'react';
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  User, 
  AlertCircle, 
  Loader2,
  Signal,
  Users
} from 'lucide-react';

// Single Remote Participant Card Component
function RemoteParticipantCard({ participant, isMultiGrid }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    }
  }, [participant.stream, participant.hasTracks, participant.connectionState]);

  const hasTracks = participant.hasTracks;

  return (
    <div
      className={`relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner group ${
        isMultiGrid ? 'h-36 min-h-[135px]' : 'w-full h-full min-h-[170px]'
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          hasTracks ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Placeholder when tracks have not yet loaded */}
      {!hasTracks && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-slate-900 text-center z-10">
          <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-2 shadow">
            <User className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-xs font-semibold text-slate-200 truncate max-w-[90%]">
            {participant.userName || 'Participant'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            {participant.connectionState === 'connected' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Connected
              </>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                Connecting WebRTC...
              </>
            )}
          </p>
        </div>
      )}

      {/* Participant Name & Role Tag */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[10px] font-medium text-slate-300 flex items-center gap-1.5 pointer-events-none z-20">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            participant.connectionState === 'connected'
              ? 'bg-emerald-400'
              : 'bg-amber-400 animate-pulse'
          }`}
        ></span>
        <span className="truncate max-w-[110px]">
          {participant.userName || 'Participant'}
        </span>
        <span className="text-[9px] text-slate-500 uppercase tracking-wider">
          ({participant.role || 'Candidate'})
        </span>
      </div>

      {/* Signal indicator */}
      <div className="absolute top-2 right-2 p-1 rounded bg-slate-950/70 border border-slate-800 text-emerald-400 pointer-events-none z-20">
        <Signal className="w-2.5 h-2.5" />
      </div>
    </div>
  );
}

export default function VideoPanel({
  localStream,
  remoteParticipants = [],
  remoteStream = null,
  remoteUser = null,
  webrtcState = 'disconnected',
  isAudioMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  mediaError,
  localUser,
  role
}) {
  const localVideoRef = useRef(null);

  // Attach local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      const p = localVideoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    }
  }, [localStream]);

  // Compute effective remote participants list
  let effectiveParticipants = remoteParticipants;
  if (effectiveParticipants.length === 0 && remoteStream) {
    effectiveParticipants = [
      {
        socketId: 'default-peer',
        userName: remoteUser?.name || (role === 'interviewer' ? 'Candidate' : 'Interviewer'),
        role: remoteUser?.role || (role === 'interviewer' ? 'candidate' : 'interviewer'),
        stream: remoteStream,
        hasTracks: Boolean(remoteStream.getTracks && remoteStream.getTracks().length > 0),
        connectionState: webrtcState
      }
    ];
  }

  const isMulti = effectiveParticipants.length > 1;

  return (
    <div className="flex flex-col gap-3 h-full select-none">
      {/* Media Permission Warning Banner */}
      {mediaError && (
        <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-start gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="leading-tight">
            <span className="font-semibold block">Media Device Access:</span>
            {mediaError}
          </div>
        </div>
      )}

      {/* Participants Counter Header */}
      {isMulti && (
        <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Active Participants</span>
          </span>
          <span className="px-1.5 py-0.5 text-[11px] rounded bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-mono font-semibold">
            {effectiveParticipants.length + 1}
          </span>
        </div>
      )}

      {/* Remote Video Container */}
      <div className="relative flex-1 bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden min-h-[170px] shadow-inner p-1 flex flex-col">
        {effectiveParticipants.length === 0 ? (
          /* Empty state: Waiting for participants */
          <div className="w-full h-full min-h-[170px] flex flex-col items-center justify-center p-4 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center mb-3 shadow-lg">
              <User className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-200">
              {role === 'interviewer' ? 'Waiting for Candidates...' : 'Waiting for Interviewer...'}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Share Room ID to allow candidates to join</span>
            </p>
          </div>
        ) : effectiveParticipants.length === 1 ? (
          /* Single Remote Participant */
          <RemoteParticipantCard
            participant={effectiveParticipants[0]}
            isMultiGrid={false}
          />
        ) : (
          /* Multiple Candidates / Participants Grid */
          <div
            className={`w-full h-full overflow-y-auto pr-0.5 grid gap-2 ${
              effectiveParticipants.length === 2 ? 'grid-cols-1' : 'grid-cols-2'
            }`}
          >
            {effectiveParticipants.map((p) => (
              <RemoteParticipantCard
                key={p.socketId}
                participant={p}
                isMultiGrid={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Local Video Container */}
      <div className="relative h-40 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-inner">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transform -scale-x-100 ${
            !isVideoOff && localStream ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Local Video Placeholder if camera is disabled */}
        {(isVideoOff || !localStream) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-slate-900">
            <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center mb-2">
              <User className="w-6 h-6 text-indigo-400" />
            </div>
            <span className="text-xs font-medium text-slate-300">
              {localUser?.name || 'You'}
            </span>
            <span className="text-[10px] text-slate-500">Camera Off</span>
          </div>
        )}

        {/* Local Tag */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-md border border-slate-800 text-[10px] font-medium text-slate-300 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          <span>You ({role === 'interviewer' ? 'Interviewer' : 'Candidate'})</span>
        </div>

        {/* Live Mute / Video control bar */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 shadow-xl z-20">
          <button
            onClick={onToggleAudio}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className={`p-2 rounded-full transition-all ${
              isAudioMuted
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleVideo}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            className={`p-2 rounded-full transition-all ${
              isVideoOff
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <VideoIcon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
