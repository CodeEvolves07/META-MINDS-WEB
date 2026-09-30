import { interviewStore } from '../services/interviewStore.js';
import { verifyToken } from '../services/authService.js';
import { isApprovedProblem } from '../services/problemRepository.js';
import { interactiveExecutionManager } from '../services/interactiveExecutionManager.js';

export function setupInterviewSocket(io) {
  io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUserRole = null;
    let currentUserName = null;

    // 1. Join Room
    socket.on('join-room', ({ roomId, role, userName, candidateId, token }) => {
      if (!roomId) return;

      let effectiveRole = role || 'candidate';
      let effectiveUserName = userName || (effectiveRole === 'interviewer' ? 'Interviewer' : 'Candidate');
      let effectiveCandidateId = candidateId || (effectiveRole === 'candidate' ? effectiveUserName : null);

      // Verify token if provided
      const tokenToVerify = token || socket.handshake.auth?.token;
      if (tokenToVerify) {
        const verified = verifyToken(tokenToVerify);
        if (verified && verified.roomId === roomId) {
          // Token claims are immutable and override client-supplied values
          effectiveRole = verified.role;
          effectiveUserName = verified.userName;
          effectiveCandidateId = verified.candidateId;
        } else if (verified && verified.roomId !== roomId) {
          console.warn(`[SECURITY] Blocked socket ${socket.id} joining ${roomId} with token for ${verified.roomId}`);
          socket.emit('error', { message: 'Token not authorized for this interview room.' });
          return;
        }
      } else {
        if (effectiveRole === 'candidate') {
          interviewStore.registerCandidate(roomId, effectiveUserName);
        }
      }

      currentRoomId = roomId;
      currentUserRole = effectiveRole;
      currentUserName = effectiveUserName;
      const currentCandidateId = effectiveCandidateId;

      socket.data = {
        role: currentUserRole,
        userName: currentUserName,
        candidateId: currentCandidateId,
        roomId
      };

      socket.join(roomId);
      interviewStore.setParticipantStatus(roomId, currentUserRole, true);

      const interview = interviewStore.getInterview(roomId, currentUserRole, currentCandidateId);

      // Send initial room state to joining socket (role-filtered for candidate privacy)
      socket.emit('room-state', {
        roomId,
        role: currentUserRole,
        code: interview ? interview.code : '',
        language: interview ? interview.language : 'python',
        problemId: interview?.problemId || null,
        status: interview ? interview.status : 'active',
        participants: interview ? interview.participants : {},
        candidateId: currentCandidateId,
        candidateCode: interview?.candidateCode || {},
        candidateOutputs: interview?.candidateOutputs || {},
        assignedQuestions: interview?.assignedQuestions || {},
        registeredCandidates: interview?.registeredCandidates || []
      });

      // Notify joining socket about existing peers already in this room
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          if (sId !== socket.id) {
            const peerSocket = io.sockets.sockets.get(sId);
            if (peerSocket) {
              socket.emit('existing-peer', {
                socketId: sId,
                role: peerSocket.data?.role || (currentUserRole === 'interviewer' ? 'candidate' : 'interviewer'),
                userName: peerSocket.data?.userName || (currentUserRole === 'interviewer' ? 'Candidate' : 'Interviewer'),
                candidateId: peerSocket.data?.candidateId || peerSocket.data?.userName
              });
            }
          }
        }
      }

      // Notify others in room
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        role: currentUserRole,
        userName: currentUserName,
        candidateId: currentCandidateId
      });

      // Inform existing peers that this user is ready for WebRTC handshake
      socket.to(roomId).emit('peer-ready', {
        socketId: socket.id,
        role: currentUserRole,
        userName: currentUserName
      });
    });

    // 2. Real-time Isolated Candidate Code Synchronization (CANDIDATE PRIVACY)
    // Candidate code is routed ONLY to Interviewers - NEVER to other candidates!
    socket.on('candidate-code-change', ({ roomId, candidateId, questionId, code, language }) => {
      if (!roomId || !questionId) return;

      // Identity Enforcement: Candidate socket can ONLY update their own code
      const authorCandId = socket.data?.candidateId || currentUserName;
      if (socket.data?.role === 'candidate' && candidateId && candidateId !== authorCandId) {
        console.warn(`[SECURITY] Blocked candidate ${authorCandId} from editing code for ${candidateId}`);
        return;
      }

      interviewStore.saveCandidateCode(roomId, authorCandId, questionId, code, language);

      // Forward ONLY to interviewers in this room!
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket && targetSocket.data?.role === 'interviewer') {
            targetSocket.emit('candidate-code-update', {
              candidateId: authorCandId,
              candidateName: socket.data?.userName || currentUserName,
              questionId,
              code,
              language: language || 'python'
            });
          }
        }
      }
    });

    // 3. Isolated Programming Language Synchronization (Candidate -> Interviewer only)
    socket.on('candidate-language-change', ({ roomId, candidateId, questionId, language }) => {
      if (!roomId || !questionId) return;

      const authorCandId = socket.data?.candidateId || currentUserName;
      if (socket.data?.role === 'candidate' && candidateId && candidateId !== authorCandId) {
        return;
      }

      interviewStore.saveCandidateLanguage(roomId, authorCandId, questionId, language);

      // Forward ONLY to interviewers in this room!
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket && targetSocket.data?.role === 'interviewer') {
            targetSocket.emit('candidate-language-update', {
              candidateId: authorCandId,
              questionId,
              language
            });
          }
        }
      }
    });

    // 4. Candidate active question change notification (Informs Interviewer in real time)
    socket.on('candidate-question-change', ({ roomId, candidateId, questionId }) => {
      if (!roomId) return;

      const authorCandId = socket.data?.candidateId || currentUserName;
      if (socket.data?.role === 'candidate' && candidateId && candidateId !== authorCandId) {
        return;
      }

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket && targetSocket.data?.role === 'interviewer') {
            targetSocket.emit('candidate-question-update', {
              candidateId: authorCandId,
              questionId
            });
          }
        }
      }
    });

    // 5. Question Assignment: Interviewer assigns questions to a candidate
    socket.on('assign-questions', ({ roomId, candidateId, questionIds }) => {
      if (!roomId || !candidateId) return;

      // Role check: Only an authorized interviewer can assign questions!
      if (socket.data?.role !== 'interviewer') {
        console.warn(`[SECURITY] Blocked non-interviewer socket ${socket.id} from assigning questions`);
        socket.emit('error', { message: 'Forbidden: Only an authorized interviewer can assign questions.' });
        return;
      }

      if (socket.data?.roomId !== roomId) {
        console.warn(`[SECURITY] Socket ${socket.id} tried assigning questions for another room`);
        socket.emit('error', { message: 'Forbidden: Socket is not authorized for this interview room.' });
        return;
      }

      const qIds = Array.isArray(questionIds) ? questionIds : [questionIds];
      const validQuestions = qIds.filter((q) => isApprovedProblem(q));
      if (validQuestions.length === 0 && qIds.length > 0) {
        console.warn(`[SECURITY] Blocked assignment of unapproved question: ${questionIds}`);
        socket.emit('error', { message: 'Invalid question: Question does not exist in the approved question repository.' });
        return;
      }

      interviewStore.assignQuestions(roomId, candidateId, validQuestions);

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          // Send to the targeted candidate ONLY
          if (targetSocket && (targetSocket.data?.candidateId === candidateId || targetSocket.data?.userName === candidateId)) {
            targetSocket.emit('assigned-questions-update', {
              candidateId,
              assignedQuestionIds: validQuestions
            });
          }
          // Also sync with all interviewers in the room
          if (targetSocket && targetSocket.data?.role === 'interviewer') {
            targetSocket.emit('interviewer-assignments-update', {
              candidateId,
              assignedQuestionIds: validQuestions
            });
          }
        }
      }
    });

    // Backwards-compatible problem change
    socket.on('problem-change', ({ roomId, problemId }) => {
      if (!roomId) return;
      interviewStore.updateProblem(roomId, problemId);
      socket.to(roomId).emit('problem-update', { problemId });
    });

    // Backwards-compatible legacy code-change
    socket.on('code-change', ({ roomId, code }) => {
      if (!roomId) return;
      interviewStore.updateCode(roomId, { code });
      socket.to(roomId).emit('code-update', { code });
    });

    // Backwards-compatible legacy language-change
    socket.on('language-change', ({ roomId, language }) => {
      if (!roomId) return;
      interviewStore.updateCode(roomId, { language });
      socket.to(roomId).emit('language-update', { language });
    });

    // 5. WebRTC Signaling (Multi-peer Mesh Audio & Video)
    socket.on('webrtc-offer', ({ roomId, targetSocketId, offer }) => {
      if (!targetSocketId) {
        socket.to(roomId).emit('webrtc-offer', {
          senderSocketId: socket.id,
          senderUserName: currentUserName,
          senderRole: currentUserRole,
          offer
        });
        return;
      }
      console.log(`📡 [SIGNALING] Offer: ${socket.id} (${currentUserName}, ${currentUserRole}) -> target: ${targetSocketId}`);
      io.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        senderUserName: currentUserName,
        senderRole: currentUserRole,
        offer
      });
    });

    socket.on('webrtc-answer', ({ roomId, targetSocketId, answer }) => {
      if (!targetSocketId) {
        socket.to(roomId).emit('webrtc-answer', {
          senderSocketId: socket.id,
          senderUserName: currentUserName,
          senderRole: currentUserRole,
          answer
        });
        return;
      }
      console.log(`📡 [SIGNALING] Answer: ${socket.id} (${currentUserName}, ${currentUserRole}) -> target: ${targetSocketId}`);
      io.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        senderUserName: currentUserName,
        senderRole: currentUserRole,
        answer
      });
    });

    socket.on('webrtc-ice-candidate', ({ roomId, targetSocketId, candidate }) => {
      if (!targetSocketId) {
        socket.to(roomId).emit('webrtc-ice-candidate', {
          senderSocketId: socket.id,
          candidate
        });
        return;
      }
      console.log(`📡 [SIGNALING] ICE candidate: ${socket.id} (${currentUserName}) -> target: ${targetSocketId}`);
      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate
      });
    });

    // 6. Running code notification (CANDIDATE PRIVACY: Routed strictly to runner + interviewers, NEVER other candidates!)
    socket.on('candidate-code-run-started', ({ roomId, candidateId, questionId, userName }) => {
      if (!roomId) return;
      const targetCandId = candidateId || socket.data?.candidateId || currentUserName;

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket) {
            const isSelf = targetSocket.id === socket.id ||
                           targetSocket.data?.candidateId === targetCandId ||
                           targetSocket.data?.userName === targetCandId;
            const isInterviewer = targetSocket.data?.role === 'interviewer';

            if (isSelf || isInterviewer) {
              targetSocket.emit('candidate-code-run-started', {
                candidateId: targetCandId,
                questionId,
                userName: userName || currentUserName
              });
            }
          }
        }
      }
    });

    socket.on('candidate-code-run-completed', ({ roomId, candidateId, questionId, result }) => {
      if (!roomId) return;
      // Enforce candidate identity: Candidate cannot forge execution outputs for another candidate
      const targetCandId = socket.data?.role === 'candidate'
        ? (socket.data?.candidateId || currentUserName)
        : (candidateId || socket.data?.candidateId || currentUserName);

      if (targetCandId && questionId && result) {
        interviewStore.saveCandidateOutput(roomId, targetCandId, questionId, result);
      }

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket) {
            const isSelf = targetSocket.id === socket.id ||
                           targetSocket.data?.candidateId === targetCandId ||
                           targetSocket.data?.userName === targetCandId;
            const isInterviewer = targetSocket.data?.role === 'interviewer';

            if (isSelf || isInterviewer) {
              targetSocket.emit('candidate-code-run-completed', {
                candidateId: targetCandId,
                questionId,
                result
              });
            }
          }
        }
      }
    });

    // ==========================================
    // 6. Real-Time Interactive Terminal Execution
    // ==========================================
    socket.on('terminal-start', async ({ roomId, questionId, code, language, candidateId }) => {
      if (!roomId) return;

      if (socket.data?.roomId !== roomId) {
        socket.emit('terminal-error', { message: 'Unauthorized: Socket is not authorized for this interview room.' });
        return;
      }

      // Identity verification: candidate can ONLY execute code as themselves
      const authorCandId = socket.data?.role === 'candidate'
        ? (socket.data?.candidateId || currentUserName)
        : (candidateId || currentUserName || 'Interviewer');

      // Helper to route terminal events strictly to authorized parties (Owner + Interviewers)
      const emitToAuthorized = (eventName, payload) => {
        const roomSockets = io.sockets.adapter.rooms.get(roomId);
        if (roomSockets) {
          for (const sId of roomSockets) {
            const targetSocket = io.sockets.sockets.get(sId);
            if (targetSocket) {
              const isOwner = targetSocket.id === socket.id ||
                             (targetSocket.data?.role === 'candidate' &&
                              (targetSocket.data?.candidateId === authorCandId || targetSocket.data?.userName === authorCandId));
              const isInterviewer = targetSocket.data?.role === 'interviewer';
              if (isOwner || isInterviewer) {
                targetSocket.emit(eventName, payload);
              }
            }
          }
        }
      };

      emitToAuthorized('terminal-started', {
        roomId,
        candidateId: authorCandId,
        questionId
      });

      const session = await interactiveExecutionManager.startSession({
        roomId,
        candidateId: authorCandId,
        questionId,
        code,
        language: language || 'python',
        onOutput: ({ stream, data }) => {
          emitToAuthorized('terminal-output', {
            sessionId: session?.id,
            candidateId: authorCandId,
            questionId,
            stream,
            data
          });
        },
        onExit: ({ exitCode, signal, totalOutput }) => {
          emitToAuthorized('terminal-exit', {
            sessionId: session?.id,
            candidateId: authorCandId,
            questionId,
            exitCode,
            signal
          });

          // Save candidate output in store for persistence & report
          const isSuccess = exitCode === 0;
          const resultObj = {
            success: isSuccess,
            engine: language === 'python' ? 'Python 3 Sandbox' : (language === 'cpp' ? 'C++ Sandbox' : 'Node.js Sandbox'),
            stdout: totalOutput,
            stderr: !isSuccess ? totalOutput : '',
            compile_output: '',
            time: '0.05s',
            status: { id: isSuccess ? 3 : 11, description: isSuccess ? 'Accepted' : 'Runtime Error' }
          };
          interviewStore.saveCandidateOutput(roomId, authorCandId, questionId, resultObj);

          emitToAuthorized('candidate-code-run-completed', {
            roomId,
            candidateId: authorCandId,
            questionId,
            result: resultObj
          });
        },
        onError: (err) => {
          emitToAuthorized('terminal-error', {
            sessionId: session?.id,
            candidateId: authorCandId,
            questionId,
            message: err.message
          });
        }
      });

      if (session) {
        socket.emit('terminal-ready', {
          sessionId: session.id,
          candidateId: authorCandId,
          questionId
        });
      }
    });

    socket.on('terminal-input', ({ roomId, sessionId, input }) => {
      if (!roomId || !sessionId || typeof input !== 'string') return;

      const session = interactiveExecutionManager.getSession(sessionId);
      if (!session || session.roomId !== roomId) return;

      // Cross-candidate isolation: Candidate A cannot write to Candidate B's process
      if (socket.data?.role === 'candidate' && socket.data?.candidateId !== session.candidateId) {
        console.warn(`[SECURITY] Blocked cross-candidate terminal-input attempt`);
        return;
      }

      interactiveExecutionManager.writeStdin(sessionId, input);
    });

    socket.on('terminal-stop', ({ roomId, sessionId }) => {
      if (!roomId || !sessionId) return;

      const session = interactiveExecutionManager.getSession(sessionId);
      if (!session || session.roomId !== roomId) return;

      if (socket.data?.role === 'candidate' && socket.data?.candidateId !== session.candidateId) {
        return;
      }

      interactiveExecutionManager.killSession(sessionId, 'Stopped by user');
    });

    // Backwards-compatible legacy code-run events (scoped to avoid leaking to other candidates)
    socket.on('code-run-started', ({ roomId, userName, candidateId, questionId }) => {
      if (!roomId) return;
      const targetCandId = socket.data?.role === 'candidate'
        ? (socket.data?.candidateId || currentUserName)
        : (candidateId || socket.data?.candidateId || currentUserName);
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket && (targetSocket.data?.role === 'interviewer' || targetSocket.id === socket.id)) {
            targetSocket.emit('code-run-started', {
              userName: userName || currentUserName,
              candidateId: targetCandId,
              questionId
            });
          }
        }
      }
    });

    socket.on('code-run-completed', ({ roomId, result, candidateId, questionId }) => {
      if (!roomId) return;
      const targetCandId = socket.data?.role === 'candidate'
        ? (socket.data?.candidateId || currentUserName)
        : (candidateId || socket.data?.candidateId || currentUserName);
      if (targetCandId && questionId && result) {
        interviewStore.saveCandidateOutput(roomId, targetCandId, questionId, result);
      }
      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket && (targetSocket.data?.role === 'interviewer' || targetSocket.id === socket.id)) {
            targetSocket.emit('code-run-completed', {
              candidateId: targetCandId,
              questionId,
              result
            });
          }
        }
      }
    });

    // 7. Code Submission Event (PRIVACY: Routed strictly to Interviewers, NEVER broadcast to other candidates!)
    socket.on('code-submitted', ({ roomId, submission }) => {
      if (!roomId) return;
      const submittingCandId = socket.data?.candidateId || currentUserName;

      interviewStore.saveSubmission(roomId, submittingCandId, submission);

      const roomSockets = io.sockets.adapter.rooms.get(roomId);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const targetSocket = io.sockets.sockets.get(sId);
          if (targetSocket && targetSocket.data?.role === 'interviewer') {
            targetSocket.emit('code-submitted', {
              userName: socket.data?.userName || currentUserName,
              candidateId: submittingCandId,
              submission
            });
          }
        }
      }
    });

    // 8. End Interview (Authorized to Interviewer only)
    socket.on('end-interview', ({ roomId }) => {
      if (!roomId) return;
      if (socket.data?.role !== 'interviewer') {
        console.warn(`[SECURITY] Blocked unauthorized end-interview attempt from socket ${socket.id}`);
        return;
      }
      interactiveExecutionManager.cleanupRoom(roomId);
      interviewStore.endInterview(roomId);
      io.in(roomId).emit('interview-ended', { roomId });
    });

    // 9. Disconnect handling (notify remaining participants & cleanup abandoned processes)
    socket.on('disconnecting', () => {
      if (currentRoomId && socket.data?.candidateId) {
        interactiveExecutionManager.killCandidateSession(currentRoomId, socket.data.candidateId, 'Client disconnected');
      }
      if (currentRoomId) {
        if (currentUserRole) {
          interviewStore.setParticipantStatus(currentRoomId, currentUserRole, false);
        }
        console.log(`🔌 [SIGNALING] User disconnecting: ${socket.id} (${currentUserName}, ${currentUserRole}) from room ${currentRoomId}`);
        io.to(currentRoomId).emit('user-left', {
          socketId: socket.id,
          role: currentUserRole,
          userName: currentUserName
        });
      }
    });
  });
}
