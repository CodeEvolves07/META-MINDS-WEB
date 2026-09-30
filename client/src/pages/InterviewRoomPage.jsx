import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { initSocket, getSocket, disconnectSocket } from '../services/socket';
import { WebRTCManager } from '../services/webrtc';
import { PROBLEMS, DEFAULT_PROBLEM } from '../data/problems';

import Navbar from '../components/Navbar';
import VideoPanel from '../components/VideoPanel';
import ProblemSection from '../components/ProblemSection';
import MonacoCodeEditor from '../components/MonacoCodeEditor';
import OutputConsole from '../components/OutputConsole';
import InterviewerNotes from '../components/InterviewerNotes';
import CandidateGuidance from '../components/CandidateGuidance';
import EndInterviewModal from '../components/EndInterviewModal';

import { Loader2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function InterviewRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Role resolution: state > localStorage > candidate default
  const storedRole = localStorage.getItem(`codemeet_role_${roomId}`);
  const role = location.state?.role || storedRole || 'candidate';
  const isInterviewer = role === 'interviewer';

  // User name resolution
  const storedUserName = localStorage.getItem(`codemeet_user_${roomId}`);
  const userName = location.state?.userName || storedUserName || (isInterviewer ? 'Interviewer' : 'Candidate');

  // Authenticated token resolution
  const storedToken = localStorage.getItem(`codemeet_token_${roomId}`);
  const token = location.state?.token || storedToken || null;

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [interviewSession, setInterviewSession] = useState(null);

  // Real-time connection states
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'peer_joined'
  const [webrtcState, setWebrtcState] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [mediaError, setMediaError] = useState('');

  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remoteUser, setRemoteUser] = useState(null);

  // Problem & Code states
  const [currentProblemId, setCurrentProblemId] = useState(isInterviewer ? DEFAULT_PROBLEM.id : null);
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(''); // COMPLETELY BLANK MONACO EDITOR INITIALLY!
  const [stdin, setStdin] = useState(''); // Runtime STDIN is empty by default; NEVER initialized with question sample input!
  const [candidateStdinMap, setCandidateStdinMap] = useState({}); // Per-question candidate-entered STDIN: { [questionId]: string }

  // Per-candidate isolated code storage & question assignments
  const [candidateCodeMap, setCandidateCodeMap] = useState({}); // Candidate's per-question code: { [questionId]: { code, language } }
  const [allCandidatesCodeMap, setAllCandidatesCodeMap] = useState({}); // Interviewer's map: { [candidateId]: { [questionId]: { code, language } } }
  const [selectedCandidateId, setSelectedCandidateId] = useState(''); // Interviewer selected candidate to observe
  const [assignedQuestionIds, setAssignedQuestionIds] = useState([]); // Questions assigned to this candidate
  const [assignedMap, setAssignedMap] = useState({}); // All assignments: { [candidateId]: string[] }

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outputResult, setOutputResult] = useState(null);
  const [candidateOutputMap, setCandidateOutputMap] = useState({}); // Candidate's per-question output: { [questionId]: result }
  const [allCandidatesOutputMap, setAllCandidatesOutputMap] = useState({}); // Interviewer's map: { [candidateId]: { [questionId]: result } }
  const [terminalLog, setTerminalLog] = useState('');
  const [activeTerminalSessionId, setActiveTerminalSessionId] = useState(null);
  const [candidateTerminalMap, setCandidateTerminalMap] = useState({}); // { [candidateId]: { [questionId]: string } }

  // Interviewer Private Notes (Role-guarded!)
  const [privateNotes, setPrivateNotes] = useState({
    communicationRating: 0,
    problemSolvingRating: 0,
    technicalRating: 0,
    comments: '',
    overallScore: 0
  });
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // End Interview Modal
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Notification banners / toasts
  const [toastMessage, setToastMessage] = useState('');

  // Refs for WebRTC & Socket & Echo control
  const webrtcManagerRef = useRef(null);
  const isRemoteCodeUpdate = useRef(false);
  const currentProblemRef = useRef(currentProblemId);
  currentProblemRef.current = currentProblemId;
  const currentLanguageRef = useRef(language);
  currentLanguageRef.current = language;
  const selectedCandidateIdRef = useRef(selectedCandidateId);
  selectedCandidateIdRef.current = selectedCandidateId;
  const activeTerminalSessionIdRef = useRef(activeTerminalSessionId);
  activeTerminalSessionIdRef.current = activeTerminalSessionId;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // 1. Initial Room Validation and Setup
  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      try {
        setIsLoading(true);
        const res = await api.getInterview(roomId, role, isInterviewer ? null : userName, token);

        if (!res.success || !res.interview) {
          setRoomError('Interview room not found.');
          setIsLoading(false);
          return;
        }

        if (isMounted) {
          setInterviewSession(res.interview);
          const initialLang = res.interview.language || 'python';
          setLanguage(initialLang);

          if (isInterviewer) {
            // Interviewer starts with empty editor or observed candidate code
            if (res.interview.candidateCode) {
              setAllCandidatesCodeMap(res.interview.candidateCode);
            }
            if (res.interview.candidateOutputs) {
              setAllCandidatesOutputMap(res.interview.candidateOutputs);
            }
            if (res.interview.assignedQuestions) {
              setAssignedMap(res.interview.assignedQuestions);
            }
            if (res.interview.privateNotes) {
              setPrivateNotes(res.interview.privateNotes);
            }
            setCode('');
            setCurrentProblemId(DEFAULT_PROBLEM.id);
          } else {
            // Candidate: Completely blank unless previously typed by this candidate
            const candCodeObj = res.interview.candidateCode?.[userName] || {};
            setCandidateCodeMap(candCodeObj);
            const myAssigned = res.interview.assignedQuestions?.[userName] || [];
            setAssignedQuestionIds(myAssigned);

            const probId = myAssigned.length > 0 ? myAssigned[0] : null;
            setCurrentProblemId(probId);

            const myOutputs = res.interview.candidateOutputs?.[userName] || {};
            setCandidateOutputMap(myOutputs);
            if (probId && myOutputs[probId]) {
              setOutputResult(myOutputs[probId]);
            } else {
              setOutputResult(null);
            }

            if (probId && candCodeObj[probId]?.code !== undefined) {
              setCode(candCodeObj[probId].code);
              if (candCodeObj[probId].language) setLanguage(candCodeObj[probId].language);
            } else {
              // COMPLETELY BLANK MONACO EDITOR! No starter solution!
              setCode('');
            }
          }

          // Runtime stdin starts empty (never auto-load question sample input)
          setStdin('');

          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load room:', err);
        if (isMounted) {
          setRoomError(err.response?.data?.message || 'Interview room not found or unavailable.');
          setIsLoading(false);
        }
      }
    }

    loadRoom();

    return () => {
      isMounted = false;
    };
  }, [roomId, role, isInterviewer]);

  // 2. Initialize Socket and WebRTC connections
  useEffect(() => {
    if (isLoading || roomError) return;

    const socket = initSocket();
    setSocketConnected(socket.connected);

    // Instantiate Multi-Peer WebRTC Manager
    const webrtc = new WebRTCManager({
      socket,
      roomId,
      onRemoteStream: (stream, peerSocketId, peerRecord) => {
        setRemoteStream(stream);
        if (peerRecord) {
          setRemoteUser({ name: peerRecord.userName, role: peerRecord.role });
        }
      },
      onParticipantsChange: (participantsList) => {
        setRemoteParticipants(participantsList);
        if (participantsList.length > 0) {
          setConnectionStatus('connected');
          setWebrtcState('connected');
          const firstWithTracks = participantsList.find((p) => p.hasTracks) || participantsList[0];
          setRemoteStream(firstWithTracks.stream);
          setRemoteUser({ name: firstWithTracks.userName, role: firstWithTracks.role });
        } else {
          setRemoteStream(null);
          setRemoteUser(null);
          setConnectionStatus('peer_joined');
        }
      },
      onRemoteStreamRemoved: (peerSocketId) => {
        setRemoteParticipants((prev) => prev.filter((p) => p.socketId !== peerSocketId));
      },
      onConnectionStateChange: (state) => {
        setWebrtcState(state);
        if (state === 'connected') {
          setConnectionStatus('connected');
        }
      },
      onError: (err) => {
        setMediaError(err.message);
      }
    });

    webrtcManagerRef.current = webrtc;

    // Fetch dynamic STUN + TURN configurations from backend
    api.getIceServers().then((iceServers) => {
      if (iceServers && webrtcManagerRef.current) {
        webrtcManagerRef.current.setIceServers(iceServers);
      }
    });

    // Start local camera and mic
    webrtc
      .startLocalMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        setMediaError('');
      })
      .catch((err) => {
        console.warn('Local media could not be started:', err.message);
        setMediaError(err.message);
      });

    // Socket Event Listeners
    socket.on('connect', () => {
      console.log('[WEBRTC] socket connected');
      console.log('[WEBRTC] joined room:', roomId);
      setSocketConnected(true);
      // Join Room with authentication token
      socket.emit('join-room', {
        roomId,
        role,
        userName,
        token
      });
    });

    socket.on('disconnect', () => {
      console.log('[WEBRTC] socket disconnected');
      setSocketConnected(false);
      setConnectionStatus('connecting');
    });

    // Room state received from server on join
    socket.on('room-state', (data) => {
      if (data.assignedQuestions) {
        if (isInterviewer) {
          setAssignedMap(data.assignedQuestions);
        } else if (data.assignedQuestions[userName]) {
          setAssignedQuestionIds(data.assignedQuestions[userName]);
        }
      }
      if (data.candidateCode) {
        if (isInterviewer) {
          setAllCandidatesCodeMap(data.candidateCode);
        } else if (data.candidateCode[userName]) {
          setCandidateCodeMap(data.candidateCode[userName]);
          const myCodeForCurrent = data.candidateCode[userName][currentProblemRef.current];
          if (myCodeForCurrent?.code !== undefined) {
            setCode(myCodeForCurrent.code);
            if (myCodeForCurrent.language) setLanguage(myCodeForCurrent.language);
          }
        }
      }
      if (data.candidateOutputs) {
        if (isInterviewer) {
          setAllCandidatesOutputMap(data.candidateOutputs);
        } else if (data.candidateOutputs[userName]) {
          setCandidateOutputMap(data.candidateOutputs[userName]);
          if (data.candidateOutputs[userName][currentProblemRef.current]) {
            setOutputResult(data.candidateOutputs[userName][currentProblemRef.current]);
          }
        }
      }
    });

    // When existing peer is detected in room: immediately pre-initialize peer connection
    socket.on('existing-peer', (peer) => {
      console.log('[WEBRTC-DIAG] existing participant in room:', peer.userName, `(${peer.role}, ${peer.socketId})`);
      webrtc.getOrCreatePeer(peer.socketId, { userName: peer.userName, role: peer.role });
      setRemoteParticipants((prev) => {
        if (prev.some((p) => p.socketId === peer.socketId)) return prev;
        return [
          ...prev,
          {
            socketId: peer.socketId,
            userName: peer.userName,
            role: peer.role,
            candidateId: peer.candidateId || peer.userName,
            stream: null,
            hasTracks: false,
            connectionState: 'connecting'
          }
        ];
      });
    });

    // When new peer enters room
    socket.on('user-joined', (peer) => {
      console.log('[WEBRTC-DIAG] participant joined:', peer.userName, `(${peer.role}, ${peer.socketId})`);
      webrtc.getOrCreatePeer(peer.socketId, { userName: peer.userName, role: peer.role });
      setRemoteParticipants((prev) => {
        if (prev.some((p) => p.socketId === peer.socketId)) return prev;
        return [
          ...prev,
          {
            socketId: peer.socketId,
            userName: peer.userName,
            role: peer.role,
            candidateId: peer.candidateId || peer.userName,
            stream: null,
            hasTracks: false,
            connectionState: 'connecting'
          }
        ];
      });
      showToast(`${peer.userName} (${peer.role}) joined the interview room.`);
    });

    // Peer ready for WebRTC call: existing participant initiates offer to newcomer
    socket.on('peer-ready', async (peer) => {
      console.log('[WEBRTC-DIAG] peer-ready received for WebRTC call, peer:', peer.userName, peer.socketId);
      await webrtc.createOffer(peer.socketId, { userName: peer.userName, role: peer.role });
    });

    // WebRTC Signaling Handlers (Multi-Peer Mesh)
    socket.on('webrtc-offer', async ({ offer, senderSocketId, senderUserName, senderRole }) => {
      await webrtc.handleOffer(offer, senderSocketId, { userName: senderUserName, role: senderRole });
    });

    socket.on('webrtc-answer', async ({ answer, senderSocketId }) => {
      console.log(`[WEBRTC-DIAG] Received answer from ${senderSocketId}`);
      await webrtc.handleAnswer(answer, senderSocketId);
    });

    socket.on('webrtc-ice-candidate', async ({ candidate, senderSocketId }) => {
      await webrtc.handleIceCandidate(candidate, senderSocketId);
    });

    // Peer disconnected: cleanly remove them from mesh
    socket.on('user-left', (peer) => {
      console.log('[WEBRTC-DIAG] participant left:', peer.userName, peer.socketId);
      webrtc.removePeer(peer.socketId);
      setRemoteParticipants((prev) => {
        const remaining = prev.filter((p) => p.socketId !== peer.socketId);
        if (remaining.length === 0) {
          setRemoteStream(null);
          setRemoteUser(null);
          setConnectionStatus('peer_joined');
        }
        return remaining;
      });
      showToast(`${peer.userName || 'A participant'} left the interview.`);
    });

    // Real-time Candidate Code Synchronization (Interviewer receives candidate's code in real-time)
    socket.on('candidate-code-update', ({ candidateId, candidateName, questionId, code: updatedCode, language: updatedLang }) => {
      setAllCandidatesCodeMap((prev) => ({
        ...prev,
        [candidateId]: {
          ...(prev[candidateId] || {}),
          [questionId]: { code: updatedCode, language: updatedLang }
        }
      }));

      // If Interviewer is currently viewing this candidate and question:
      if (isInterviewer) {
        const curSelected = selectedCandidateIdRef.current;
        if (curSelected === candidateId || curSelected === candidateName) {
          if (currentProblemRef.current === questionId) {
            setCode(updatedCode);
            if (updatedLang) setLanguage(updatedLang);
          }
        }
      }
    });

    // Real-time Candidate Language Synchronization
    socket.on('candidate-language-update', ({ candidateId, questionId, language: updatedLang }) => {
      setAllCandidatesCodeMap((prev) => ({
        ...prev,
        [candidateId]: {
          ...(prev[candidateId] || {}),
          [questionId]: { ...(prev[candidateId]?.[questionId] || {}), language: updatedLang }
        }
      }));
      if (isInterviewer) {
        const curSelected = selectedCandidateIdRef.current;
        if (curSelected === candidateId && currentProblemRef.current === questionId) {
          setLanguage(updatedLang);
        }
      }
    });

    // Candidate Question Update notification
    socket.on('candidate-question-update', ({ candidateId, questionId }) => {
      if (isInterviewer && selectedCandidateIdRef.current === candidateId) {
        const prob = PROBLEMS.find((p) => p.id === questionId);
        showToast(`${candidateId} is now working on: ${prob?.title || questionId}`);
      }
    });

    // Assigned Questions Update (Candidate receives their assigned questions from Interviewer)
    socket.on('assigned-questions-update', ({ candidateId, assignedQuestionIds: newAssigned }) => {
      if (!isInterviewer) {
        setAssignedQuestionIds(newAssigned || []);
        showToast('Your assigned question has been updated by the interviewer.');
        if (newAssigned && newAssigned.length > 0) {
          const firstProb = newAssigned[0];
          setCurrentProblemId(firstProb);
          setCandidateCodeMap((prev) => {
            const saved = prev[firstProb];
            setCode(saved?.code !== undefined ? saved.code : '');
            if (saved?.language) setLanguage(saved.language);
            return prev;
          });
          setCandidateOutputMap((prev) => {
            setOutputResult(prev[firstProb] || null);
            return prev;
          });
        } else {
          setCurrentProblemId(null);
          setCode('');
          setOutputResult(null);
        }
      }
    });

    // Interviewer Assignments Sync
    socket.on('interviewer-assignments-update', ({ candidateId, assignedQuestionIds: newAssigned }) => {
      if (isInterviewer) {
        setAssignedMap((prev) => ({ ...prev, [candidateId]: newAssigned || [] }));
      }
    });

    // Candidate Code Execution Notifications (ISOLATED: scoped to runner + interviewer, NEVER other candidates!)
    socket.on('candidate-code-run-started', ({ candidateId, questionId, userName: runnerName }) => {
      if (isInterviewer) {
        showToast(`${runnerName || candidateId} is running code in sandbox...`);
      }
    });

    socket.on('candidate-code-run-completed', ({ candidateId, questionId, result }) => {
      if (isInterviewer) {
        setAllCandidatesOutputMap((prev) => ({
          ...prev,
          [candidateId]: {
            ...(prev[candidateId] || {}),
            [questionId]: result
          }
        }));
        const curSelected = selectedCandidateIdRef.current;
        if (curSelected === candidateId && currentProblemRef.current === questionId) {
          setOutputResult(result);
        }
      } else {
        // Candidate: only apply if this output is for ME and for current question
        if (candidateId === userName) {
          setCandidateOutputMap((prev) => ({
            ...prev,
            [questionId]: result
          }));
          if (currentProblemRef.current === questionId) {
            setOutputResult(result);
          }
        }
      }
    });

    socket.on('code-run-completed', ({ candidateId, questionId, result }) => {
      if (isInterviewer) {
        if (candidateId) {
          setAllCandidatesOutputMap((prev) => ({
            ...prev,
            [candidateId]: { ...(prev[candidateId] || {}), [questionId]: result }
          }));
          if (selectedCandidateIdRef.current === candidateId && currentProblemRef.current === questionId) {
            setOutputResult(result);
          }
        }
      } else if (candidateId === userName && currentProblemRef.current === questionId) {
        setOutputResult(result);
      }
    });

    // Interactive Terminal Socket Listeners
    socket.on('terminal-ready', ({ sessionId, candidateId, questionId }) => {
      setActiveTerminalSessionId(sessionId);
    });

    socket.on('terminal-output', ({ sessionId, candidateId, questionId, stream, data }) => {
      setCandidateTerminalMap((prev) => {
        const candLogs = prev[candidateId] || {};
        const qLog = (candLogs[questionId] || '') + data;
        return {
          ...prev,
          [candidateId]: { ...candLogs, [questionId]: qLog }
        };
      });

      const isTargetCandidate = isInterviewer
        ? (selectedCandidateIdRef.current === candidateId)
        : (userName === candidateId);

      if (isTargetCandidate && currentProblemRef.current === questionId) {
        setTerminalLog((prev) => prev + data);
      }
    });

    socket.on('terminal-exit', ({ sessionId, candidateId, questionId, exitCode, signal }) => {
      const exitMsg = `\n[Process completed with exit code ${exitCode}]\n`;
      setCandidateTerminalMap((prev) => {
        const candLogs = prev[candidateId] || {};
        const qLog = (candLogs[questionId] || '') + exitMsg;
        return {
          ...prev,
          [candidateId]: { ...candLogs, [questionId]: qLog }
        };
      });

      const isTargetCandidate = isInterviewer
        ? (selectedCandidateIdRef.current === candidateId)
        : (userName === candidateId);

      if (isTargetCandidate && currentProblemRef.current === questionId) {
        setTerminalLog((prev) => prev + exitMsg);
        setIsRunning(false);
      }
    });

    socket.on('terminal-error', ({ sessionId, candidateId, questionId, message }) => {
      const errMsg = `\n[Error: ${message}]\n`;
      setCandidateTerminalMap((prev) => {
        const candLogs = prev[candidateId] || {};
        const qLog = (candLogs[questionId] || '') + errMsg;
        return {
          ...prev,
          [candidateId]: { ...candLogs, [questionId]: qLog }
        };
      });

      const isTargetCandidate = isInterviewer
        ? (selectedCandidateIdRef.current === candidateId)
        : (userName === candidateId);

      if (isTargetCandidate && currentProblemRef.current === questionId) {
        setTerminalLog((prev) => prev + errMsg);
        setIsRunning(false);
      }
    });

    // Code submitted
    socket.on('code-submitted', ({ userName: submitterName, submission }) => {
      showToast(`🎉 ${submitterName} has submitted their final solution!`);
    });

    // Interview ended by interviewer
    socket.on('interview-ended', () => {
      showToast('The interview session has ended.');
      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.close();
      }
      setTimeout(() => {
        navigate(`/report/${roomId}`, {
          state: { role, userName }
        });
      }, 1000);
    });

    // Initial join emission if socket was already open
    if (socket.connected) {
      console.log('[WEBRTC] socket connected');
      console.log('[WEBRTC] joined room:', roomId);
      socket.emit('join-room', {
        roomId,
        role,
        userName,
        candidateId: isInterviewer ? null : userName
      });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-state');
      socket.off('existing-peer');
      socket.off('user-joined');
      socket.off('peer-ready');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('candidate-code-update');
      socket.off('candidate-language-update');
      socket.off('candidate-question-update');
      socket.off('assigned-questions-update');
      socket.off('interviewer-assignments-update');
      socket.off('candidate-code-run-started');
      socket.off('candidate-code-run-completed');
      socket.off('code-run-started');
      socket.off('code-run-completed');
      socket.off('code-submitted');
      socket.off('interview-ended');
      socket.off('user-left');
      socket.off('terminal-ready');
      socket.off('terminal-output');
      socket.off('terminal-exit');
      socket.off('terminal-error');

      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.close();
      }
    };
  }, [isLoading, roomError, roomId, role, userName, isInterviewer]);

  // Candidate list for interviewer (includes connected participants + known room candidates)
  const candidateIdsSet = new Set();
  const candidatesList = [];

  if (isInterviewer) {
    remoteParticipants.forEach((p) => {
      if (p.role === 'candidate') {
        const cId = p.candidateId || p.userName;
        if (cId && !candidateIdsSet.has(cId)) {
          candidateIdsSet.add(cId);
          candidatesList.push({
            candidateId: cId,
            userName: p.userName || cId,
            socketId: p.socketId,
            status: 'Joined'
          });
        }
      }
    });

    const knownCandidateIds = [
      ...(interviewSession?.registeredCandidates || []),
      ...Object.keys(assignedMap || {})
    ];
    knownCandidateIds.forEach((cId) => {
      if (cId && cId !== 'Interviewer' && !candidateIdsSet.has(cId)) {
        candidateIdsSet.add(cId);
        candidatesList.push({
          candidateId: cId,
          userName: cId,
          socketId: null,
          status: 'Joined'
        });
      }
    });
  }

  // Auto-select candidate for Interviewer if not selected
  useEffect(() => {
    if (!isInterviewer) return;
    if (candidatesList.length > 0) {
      const currentSelectedExists = candidatesList.some(
        (c) => (c.candidateId || c.userName) === selectedCandidateId
      );
      if (!selectedCandidateId || !currentSelectedExists) {
        const first = candidatesList[0].candidateId || candidatesList[0].userName;
        setSelectedCandidateId(first);
        const candAssigned = assignedMap[first] || [];
        const candProbId = candAssigned.length > 0 ? candAssigned[0] : (currentProblemId || DEFAULT_PROBLEM.id);
        setCurrentProblemId(candProbId);

        const candData = allCandidatesCodeMap[first]?.[candProbId];
        setCode(candData?.code || '');
        if (candData?.language) setLanguage(candData.language);
        const candOutput = allCandidatesOutputMap[first]?.[candProbId] || null;
        setOutputResult(candOutput);
      }
    }
  }, [candidatesList, isInterviewer, selectedCandidateId, currentProblemId, allCandidatesCodeMap, allCandidatesOutputMap, assignedMap]);

  // Handle Candidate Selection (Interviewer)
  const handleSelectCandidate = (candId) => {
    setSelectedCandidateId(candId);
    const candAssigned = assignedMap[candId] || [];
    const candProbId = candAssigned.length > 0 ? candAssigned[0] : (currentProblemId || DEFAULT_PROBLEM.id);
    setCurrentProblemId(candProbId);

    const candData = allCandidatesCodeMap[candId]?.[candProbId];
    setCode(candData?.code || '');
    if (candData?.language) setLanguage(candData.language);
    const candOutput = allCandidatesOutputMap[candId]?.[candProbId] || null;
    setOutputResult(candOutput);

    const candTerminal = candidateTerminalMap[candId]?.[candProbId] || '';
    setTerminalLog(candTerminal);

    showToast(`Viewing code for ${candId}`);
  };

  // Handle Code Change
  const handleChangeCode = (newCode) => {
    setCode(newCode);

    if (!isInterviewer) {
      // Candidate: update local per-question store
      setCandidateCodeMap((prev) => ({
        ...prev,
        [currentProblemId]: { code: newCode, language }
      }));

      const socket = getSocket();
      if (socket && socket.connected) {
        // CANDIDATE PRIVACY: Routed ONLY to interviewers, never broadcast to other candidates!
        socket.emit('candidate-code-change', {
          roomId,
          candidateId: userName,
          questionId: currentProblemId,
          code: newCode,
          language
        });
      }
    } else {
      // Interviewer can also edit observed candidate buffer if needed
      if (selectedCandidateId) {
        setAllCandidatesCodeMap((prev) => ({
          ...prev,
          [selectedCandidateId]: {
            ...(prev[selectedCandidateId] || {}),
            [currentProblemId]: { code: newCode, language }
          }
        }));
      }
    }
  };

  // Handle Language Change (Changing language must NOT insert solution code!)
  const handleChangeLanguage = (newLang) => {
    setLanguage(newLang);

    if (!isInterviewer) {
      setCandidateCodeMap((prev) => ({
        ...prev,
        [currentProblemId]: { ...(prev[currentProblemId] || { code }), language: newLang }
      }));

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('candidate-language-change', {
          roomId,
          candidateId: userName,
          questionId: currentProblemId,
          language: newLang
        });
      }
    }
    showToast(`Language set to ${newLang.toUpperCase()}`);
  };

  // Handle Problem Change (Per-question isolation & persistence)
  const handleSelectProblem = (newProbId) => {
    if (!isInterviewer) {
      // 1. Save current code & candidate's manual stdin for current problem
      setCandidateCodeMap((prev) => ({
        ...prev,
        [currentProblemId]: { code, language }
      }));
      setCandidateStdinMap((prev) => ({
        ...prev,
        [currentProblemId]: stdin
      }));

      // 2. Load candidate's saved code for the new problem (or completely blank "")
      const savedForNewProb = candidateCodeMap[newProbId];
      const nextCode = savedForNewProb?.code !== undefined ? savedForNewProb.code : '';
      const nextLang = savedForNewProb?.language || language;

      // 3. Load candidate's own manual stdin for the new problem (or empty "", NEVER sampleInput)
      const nextStdin = candidateStdinMap[newProbId] !== undefined ? candidateStdinMap[newProbId] : '';

      setCode(nextCode);
      setLanguage(nextLang);
      setStdin(nextStdin);
      setCurrentProblemId(newProbId);

      // 4. Load candidate's own output for the new problem
      const savedOutput = candidateOutputMap[newProbId] || null;
      setOutputResult(savedOutput);

      // Load terminal log for new problem
      const nextLog = candidateTerminalMap[userName]?.[newProbId] || '';
      setTerminalLog(nextLog);

      // 5. Notify interviewer of question switch and candidate's code
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('candidate-question-change', {
          roomId,
          candidateId: userName,
          questionId: newProbId
        });
        socket.emit('candidate-code-change', {
          roomId,
          candidateId: userName,
          questionId: newProbId,
          code: nextCode,
          language: nextLang
        });
      }
    } else {
      // Interviewer changing problem view
      setCurrentProblemId(newProbId);
      setStdin('');
      if (selectedCandidateId) {
        const candData = allCandidatesCodeMap[selectedCandidateId]?.[newProbId];
        setCode(candData?.code || '');
        if (candData?.language) setLanguage(candData.language);
        const candOutput = allCandidatesOutputMap[selectedCandidateId]?.[newProbId] || null;
        setOutputResult(candOutput);
      } else {
        setCode('');
        setOutputResult(null);
      }
    }
  };

  // Handle Candidate Stdin Change (Preserves candidate's manual input per question)
  const handleChangeStdin = (newStdin) => {
    setStdin(newStdin);
    if (!isInterviewer) {
      setCandidateStdinMap((prev) => ({
        ...prev,
        [currentProblemId]: newStdin
      }));
    }
  };

  // Reset code: Clears editor to blank workspace (NO predefined solution inserted!)
  const handleResetCode = () => {
    handleChangeCode('');
    showToast('Editor cleared to blank workspace.');
  };

  // Interviewer Assigns Problem to Candidate
  const handleAssignProblemToCandidate = async (candId, probId) => {
    if (!isInterviewer || !candId || !probId) return;

    const nextList = [probId]; // One assigned question per candidate workflow
    setAssignedMap((prev) => ({ ...prev, [candId]: nextList }));

    // 1. Real-time targeted socket emission
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('assign-questions', {
        roomId,
        candidateId: candId,
        questionIds: nextList
      });
    }

    // 2. Call REST API for backend persistence and verification
    try {
      await api.assignQuestion(roomId, candId, probId);
    } catch (err) {
      console.warn('Backend question assignment error:', err.message);
    }

    const assignedProblem = PROBLEMS.find((p) => p.id === probId);
    showToast(`Assigned "${assignedProblem?.title || probId}" to ${candId}.`);

    if (selectedCandidateId === candId) {
      setCurrentProblemId(probId);
      const candData = allCandidatesCodeMap[candId]?.[probId];
      setCode(candData?.code || '');
      if (candData?.language) setLanguage(candData.language);
      const candOutput = allCandidatesOutputMap[candId]?.[probId] || null;
      setOutputResult(candOutput);
    }
  };

  // Run Code via Real-Time Interactive Terminal Sandbox
  const handleRunCode = async () => {
    if (isRunning) return;

    try {
      setIsRunning(true);
      const runnerCandidateId = isInterviewer ? (selectedCandidateId || 'Interviewer') : userName;
      setTerminalLog('[▶ Running code in interactive terminal...]\n');

      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('terminal-start', {
          roomId,
          questionId: currentProblemId,
          code,
          language,
          candidateId: runnerCandidateId
        });

        // If candidate preloaded STDIN, forward it once process is ready
        if (stdin && stdin.trim()) {
          setTimeout(() => {
            const curSessionId = activeTerminalSessionIdRef.current;
            if (curSessionId) {
              socket.emit('terminal-input', {
                roomId,
                sessionId: curSessionId,
                input: stdin.endsWith('\n') ? stdin : stdin + '\n'
              });
            }
          }, 350);
        }
      } else {
        // Fallback to HTTP execution
        const res = await api.runCode({
          source_code: code,
          language,
          stdin: typeof stdin === 'string' ? stdin : ''
        });

        if (res.success && res.result) {
          setOutputResult(res.result);
          const outText = res.result.stdout || res.result.stderr || res.result.compile_output || '';
          setTerminalLog(outText + '\n[Process completed]\n');
        }
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Interactive terminal run error:', err);
      setTerminalLog(`Execution Error: ${err.message}\n`);
      setIsRunning(false);
    }
  };

  // Send candidate input to live process stdin
  const handleSendTerminalInput = (input) => {
    if (!input) return;
    setTerminalLog((prev) => prev + input);

    const socket = getSocket();
    const curSessionId = activeTerminalSessionIdRef.current;
    if (socket && socket.connected && curSessionId) {
      socket.emit('terminal-input', {
        roomId,
        sessionId: curSessionId,
        input
      });
    }
  };

  // Stop running execution process
  const handleStopExecution = () => {
    const socket = getSocket();
    const curSessionId = activeTerminalSessionIdRef.current;
    if (socket && socket.connected && curSessionId) {
      socket.emit('terminal-stop', {
        roomId,
        sessionId: curSessionId
      });
    }
    setTerminalLog((prev) => prev + '\n[Process stopped by user]\n');
    setIsRunning(false);
  };

  // Submit Code
  const handleSubmitCode = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await api.submitCode(roomId, {
        code,
        language,
        problemId: currentProblemId,
        executionResult: outputResult,
        testResults: outputResult?.status ? [outputResult.status.description] : ['Submitted']
      });

      if (res.success) {
        // Trigger celebratory confetti
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });

        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('code-submitted', {
            roomId,
            submission: res.submission
          });
        }
        showToast('Code submitted successfully! Results saved to interview report.');
      }
    } catch (err) {
      console.error('Submission failed:', err);
      showToast('Failed to submit code: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Interviewer Notes (INTERVIEWER ONLY)
  const handleSaveNotes = async () => {
    if (!isInterviewer) return;
    try {
      setIsSavingNotes(true);
      await api.saveNotes(roomId, privateNotes, 'interviewer');
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // End Interview Handler
  const handleConfirmEndInterview = async () => {
    try {
      setIsEnding(true);

      if (isInterviewer) {
        // Auto-archive code submission if not manually submitted yet
        if (!interviewSession?.submission && code) {
          try {
            await api.submitCode(roomId, {
              code,
              language,
              problemId: currentProblemId,
              executionResult: outputResult,
              testResults: outputResult?.status ? [outputResult.status.description] : ['Archived on End']
            });
          } catch (subErr) {
            console.warn('Auto-save submission warning:', subErr.message);
          }
        }

        await api.endInterview(roomId, privateNotes);
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('end-interview', { roomId });
        }
      }

      if (webrtcManagerRef.current) {
        webrtcManagerRef.current.close();
      }

      navigate(`/report/${roomId}`, {
        state: { role, userName }
      });
    } catch (err) {
      console.error('Error ending interview:', err);
      setIsEnding(false);
      setIsEndModalOpen(false);
    }
  };

  // Toggle Microphone
  const handleToggleAudio = () => {
    if (webrtcManagerRef.current) {
      const active = webrtcManagerRef.current.toggleAudio();
      setIsAudioMuted(!active);
    }
  };

  // Toggle Camera
  const handleToggleVideo = () => {
    if (webrtcManagerRef.current) {
      const active = webrtcManagerRef.current.toggleVideo();
      setIsVideoOff(!active);
    }
  };

  // If Room Error
  if (roomError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Interview Room Error</h2>
        <p className="text-sm text-slate-400 mb-6">{roomError}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
        >
          Return to Home
        </button>
      </div>
    );
  }

  // If Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-base font-semibold text-slate-200">
          Entering CodeMeet Interview Room...
        </h2>
        <p className="text-xs text-slate-500 mt-1">Connecting WebRTC & Code Sandbox</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 border border-indigo-500/40 text-slate-200 text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fadeIn backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        role={role}
        connectionStatus={connectionStatus}
        socketConnected={socketConnected}
        onEndInterview={() => setIsEndModalOpen(true)}
      />

      {/* Main 3-Column Studio Dashboard Layout */}
      <main className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* LEFT COLUMN: WebRTC Video & Audio Panel (Width: 3/12 on desktop) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col h-full min-h-0">
          <VideoPanel
            localStream={localStream}
            remoteParticipants={remoteParticipants}
            remoteStream={remoteStream}
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            mediaError={mediaError}
            webrtcState={webrtcState}
            remoteUser={remoteUser}
            localUser={{ name: userName, role, roomId }}
            role={role}
          />
        </section>

        {/* CENTER COLUMN: Problem + Monaco Code Editor + Output Console (Width: 6/12) */}
        <section className="col-span-12 lg:col-span-6 flex flex-col gap-2.5 h-full min-h-0">
          {/* Top: Problem Section (Compact scrollable) */}
          <div className="h-[36%] min-h-[160px] shrink-0">
            <ProblemSection
              currentProblemId={currentProblemId}
              onSelectProblem={handleSelectProblem}
              isInterviewer={isInterviewer}
              assignedProblemIds={assignedQuestionIds}
              candidatesList={candidatesList}
              onAssignProblemToCandidate={handleAssignProblemToCandidate}
              assignedMap={assignedMap}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={handleSelectCandidate}
            />
          </div>

          {/* Middle: Monaco Code Editor + Dedicated Action Bar below */}
          <div className="flex-1 min-h-[240px] flex flex-col min-h-0">
            <MonacoCodeEditor
              code={code}
              language={language}
              onChangeCode={handleChangeCode}
              onChangeLanguage={handleChangeLanguage}
              onRunCode={handleRunCode}
              onSubmitCode={handleSubmitCode}
              onResetCode={handleResetCode}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              isInterviewer={isInterviewer}
              candidatesList={candidatesList}
              selectedCandidateId={selectedCandidateId}
              onSelectCandidate={handleSelectCandidate}
            />
          </div>

          {/* Bottom: Output / Interactive Terminal Console */}
          <div className="h-[32%] min-h-[170px] max-h-[260px] shrink-0">
            <OutputConsole
              outputResult={outputResult}
              stdin={stdin}
              onChangeStdin={handleChangeStdin}
              onClearOutput={() => {
                setOutputResult(null);
                setTerminalLog('');
              }}
              isRunning={isRunning}
              terminalLog={terminalLog}
              onSendInput={handleSendTerminalInput}
              onStopProcess={handleStopExecution}
              isInterviewer={isInterviewer}
              activeCandidateName={selectedCandidateId || userName}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: Role-Guarded Notes / Candidate Guidance (Width: 3/12) */}
        <section className="col-span-12 lg:col-span-3 flex flex-col h-full min-h-0">
          {isInterviewer ? (
            <InterviewerNotes
              notes={privateNotes}
              onChangeNotes={setPrivateNotes}
              onSaveNotes={handleSaveNotes}
              isSaving={isSavingNotes}
            />
          ) : (
            <CandidateGuidance />
          )}
        </section>
      </main>

      {/* End Interview Confirmation Modal */}
      <EndInterviewModal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        onConfirm={handleConfirmEndInterview}
        isInterviewer={isInterviewer}
        notes={privateNotes}
        isEnding={isEnding}
      />
    </div>
  );
}
