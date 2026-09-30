// Multi-Peer Mesh WebRTC Manager with STUN + TURN Support
export class WebRTCManager {
  constructor({
    socket,
    roomId,
    iceServers = null,
    onRemoteStream,
    onRemoteStreamRemoved,
    onParticipantsChange,
    onConnectionStateChange,
    onError
  }) {
    this.socket = socket;
    this.roomId = roomId;
    this.onRemoteStream = onRemoteStream;
    this.onRemoteStreamRemoved = onRemoteStreamRemoved;
    this.onParticipantsChange = onParticipantsChange;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onError = onError;

    this.localStream = null;
    this.mediaPromise = null;
    this.isAudioMuted = false;
    this.isVideoOff = false;

    // Multi-peer map: peerSocketId -> PeerRecord
    this.peers = new Map();

    // Pending candidate buffer for candidates that arrive before peer connection is instantiated: peerSocketId -> Array<candidate>
    this.pendingIceCandidates = new Map();

    // Configure STUN + TURN servers
    this.iceConfig = {
      iceServers: iceServers && iceServers.length > 0 ? iceServers : this.getDefaultIceServers()
    };

    const hasTurn = this.iceConfig.iceServers.some(
      (s) => (Array.isArray(s.urls) ? s.urls.some((u) => u.startsWith('turn:')) : s.urls?.startsWith('turn:'))
    );
    if (hasTurn) {
      console.log('[WEBRTC] ICE configuration active: STUN + TURN relay enabled for cross-network connectivity.');
    } else {
      console.log('[WEBRTC] ICE configuration active: Google STUN. (Add TURN_URLS in .env for strict symmetric NAT relay).');
    }
  }

  // Default STUN servers fallback and Vite env support
  getDefaultIceServers() {
    const servers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];

    try {
      const viteTurnUrls = typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURN_URLS;
      const viteTurnUser = typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURN_USERNAME;
      const viteTurnCred = typeof import.meta !== 'undefined' && import.meta.env?.VITE_TURN_CREDENTIAL;

      if (viteTurnUrls && viteTurnUrls.trim()) {
        const urls = viteTurnUrls.split(',').map((u) => u.trim()).filter(Boolean);
        const turnEntry = { urls };
        if (viteTurnUser) turnEntry.username = viteTurnUser.trim();
        if (viteTurnCred) turnEntry.credential = viteTurnCred.trim();
        servers.push(turnEntry);
      }
    } catch {
      // Ignore env access errors in non-browser environments
    }

    return servers;
  }

  // Update ICE servers dynamically if fetched from backend and apply to all active peer connections
  setIceServers(iceServers) {
    if (iceServers && iceServers.length > 0) {
      this.iceConfig = { iceServers };
      console.log(`[WEBRTC] Updated ICE servers configuration (${iceServers.length} servers).`);

      // Ensure every existing RTCPeerConnection receives the updated STUN/TURN configuration
      for (const peer of this.peers.values()) {
        try {
          if (peer.peerConnection) {
            peer.peerConnection.setConfiguration(this.iceConfig);
            console.log(`[WEBRTC-DIAG] [${this.socket?.id} <-> ${peer.socketId}] Applied updated STUN/TURN ICE configuration to active peer: ${peer.socketId}`);
          }
        } catch (err) {
          console.warn(`[WEBRTC-DIAG] Failed to setConfiguration on peer ${peer.socketId}:`, err.message);
        }
      }
    }
  }

  // Request user camera and microphone
  async startLocalMedia(constraints = { video: true, audio: true }) {
    if (this.localStream) return this.localStream;
    if (this.mediaPromise) return this.mediaPromise;

    this.mediaPromise = (async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Your browser does not support WebRTC media devices or requires a secure context (localhost or HTTPS).');
        }

        console.log('[WEBRTC] requesting camera and microphone permissions...');
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (videoErr) {
          console.warn('[WEBRTC] Could not acquire video+audio, trying audio only:', videoErr.message);
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } catch (audioErr) {
            throw videoErr;
          }
        }

        this.localStream = stream;
        console.log(`[WEBRTC] local tracks added: audio=${stream.getAudioTracks().length}, video=${stream.getVideoTracks().length}`);

        // Attach local tracks to all existing peer connections in mesh
        for (const peer of this.peers.values()) {
          this.attachLocalTracksToPeer(peer);
        }

        return stream;
      } catch (err) {
        console.error('[WEBRTC] Failed to get media devices:', err);
        let message = 'Unable to access camera or microphone.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          message = 'Camera/Microphone permission denied. Please allow permissions in browser address bar.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          message = 'No camera or microphone found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          message = 'Camera or microphone is already in use by another application.';
        }
        if (this.onError) this.onError(new Error(message));
        throw new Error(message);
      }
    })();

    return this.mediaPromise;
  }

  // Attach local media tracks to a specific peer's RTCPeerConnection
  attachLocalTracksToPeer(peer) {
    if (!peer || !peer.peerConnection || !this.localStream) return;

    const pc = peer.peerConnection;
    const senders = pc.getSenders();
    this.localStream.getTracks().forEach((track) => {
      const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
      if (!alreadyAdded) {
        pc.addTrack(track, this.localStream);
        console.log(`[WEBRTC] local track added to peer ${peer.socketId}: ${track.kind}`);
      }
    });
  }

  // Get existing peer or create a new RTCPeerConnection for a remote participant
  getOrCreatePeer(peerSocketId, metadata = {}) {
    if (this.peers.has(peerSocketId)) {
      const existing = this.peers.get(peerSocketId);
      if (metadata.userName) existing.userName = metadata.userName;
      if (metadata.role) existing.role = metadata.role;
      return existing;
    }

    console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] Peer connection creation for target participant ID: ${peerSocketId} (${metadata.userName || 'Unknown'})`);
    const pc = new RTCPeerConnection(this.iceConfig);

    const peerRecord = {
      socketId: peerSocketId,
      userName: metadata.userName || 'Participant',
      role: metadata.role || 'candidate',
      peerConnection: pc,
      candidateQueue: [],
      remoteStream: new MediaStream(),
      connectionState: 'connecting',
      isMakingOffer: false
    };

    // Drain any pending ICE candidates that arrived before peer creation
    if (this.pendingIceCandidates.has(peerSocketId)) {
      const pending = this.pendingIceCandidates.get(peerSocketId);
      peerRecord.candidateQueue.push(...pending);
      this.pendingIceCandidates.delete(peerSocketId);
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} -> target: ${peerSocketId}] Moved ${pending.length} pending ICE candidate(s) to peer candidateQueue`);
    }

    this.peers.set(peerSocketId, peerRecord);

    // Attach local tracks if already available
    if (this.localStream) {
      this.attachLocalTracksToPeer(peerRecord);
    }

    // Configure ontrack for this specific peer
    pc.ontrack = (event) => {
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] ontrack event from target participant ID: ${peerSocketId} (${peerRecord.userName}), kind: ${event.track.kind}, id: ${event.track.id}`);

      if (event.streams && event.streams[0]) {
        peerRecord.remoteStream = event.streams[0];
      } else {
        if (!peerRecord.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          peerRecord.remoteStream.addTrack(event.track);
        }
      }

      this.notifyParticipantsChange();

      if (this.onRemoteStream) {
        this.onRemoteStream(peerRecord.remoteStream, peerSocketId, peerRecord);
      }
    };

    // Configure ICE candidate emission targeted strictly to this peer
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        console.log(`[WEBRTC-DIAG] [participant: ${this.socket.id} -> target: ${peerSocketId}] ICE candidate sender: sent to target participant ID: ${peerSocketId}`);
        const candidateData = event.candidate.toJSON
          ? event.candidate.toJSON()
          : {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              usernameFragment: event.candidate.usernameFragment
            };

        this.socket.emit('webrtc-ice-candidate', {
          roomId: this.roomId,
          targetSocketId: peerSocketId,
          candidate: candidateData
        });
      }
    };

    // Diagnostics: signaling state changes
    pc.onsignalingstatechange = () => {
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} <-> target: ${peerSocketId}] signaling state: ${pc.signalingState}`);
    };

    // Diagnostics & UI: connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} <-> target: ${peerSocketId}] connection state: ${state}`);
      peerRecord.connectionState = state;
      this.notifyParticipantsChange();

      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state, peerSocketId);
      }
    };

    // Diagnostics & Recovery: ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} <-> target: ${peerSocketId}] ICE connection state: ${iceState}`);
      if (iceState === 'connected' || iceState === 'completed') {
        peerRecord.connectionState = 'connected';
        this.notifyParticipantsChange();
        if (this.onConnectionStateChange) {
          this.onConnectionStateChange('connected', peerSocketId);
        }
      } else if (iceState === 'failed') {
        peerRecord.connectionState = 'failed';
        this.notifyParticipantsChange();
        if (pc.restartIce) {
          console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} <-> target: ${peerSocketId}] Attempting ICE restart`);
          try {
            pc.restartIce();
          } catch (e) {
            console.warn('[WEBRTC] ICE restart error:', e.message);
          }
        }
      } else if (iceState === 'disconnected') {
        peerRecord.connectionState = 'disconnected';
        this.notifyParticipantsChange();
      }
    };

    this.notifyParticipantsChange();
    return peerRecord;
  }

  // Safely flush queued ICE candidates for a peer after remote description is set
  async flushCandidateQueue(peer) {
    if (!peer || !peer.peerConnection) return;
    const pc = peer.peerConnection;
    if (!pc.remoteDescription || !pc.remoteDescription.type) return;

    while (peer.candidateQueue && peer.candidateQueue.length > 0) {
      const candidate = peer.candidateQueue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} -> target: ${peer.socketId}] Flushed queued ICE candidate`);
      } catch (e) {
        console.warn(`[WEBRTC-DIAG] Notice while flushing queued candidate for ${peer.socketId}:`, e.message);
      }
    }
  }

  // Existing peer initiates an offer to a newly joined participant
  async createOffer(targetSocketId, metadata = {}) {
    try {
      if (!targetSocketId) return;

      // 1. Immediately create peer record so incoming candidates are queued per peer
      const peer = this.getOrCreatePeer(targetSocketId, metadata);

      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] offer sender: creating offer for target participant ID: ${targetSocketId} (${metadata.userName || 'peer'})`);

      // 2. Await local camera/mic so offer contains real tracks
      if (this.mediaPromise) {
        try {
          await this.mediaPromise;
        } catch (e) {
          console.warn('[WEBRTC] Proceeding with offer despite media warning:', e.message);
        }
      }

      this.attachLocalTracksToPeer(peer);

      peer.isMakingOffer = true;
      const offer = await peer.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });

      await peer.peerConnection.setLocalDescription(offer);
      peer.isMakingOffer = false;

      this.socket.emit('webrtc-offer', {
        roomId: this.roomId,
        targetSocketId,
        offer
      });
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] offer sender: offer sent to target participant ID: ${targetSocketId}`);
    } catch (err) {
      console.error(`[WEBRTC] Error creating offer for ${targetSocketId}:`, err);
      if (this.onError) this.onError(err);
    }
  }

  // Newly joined peer receives an offer from an existing participant, responds with answer
  async handleOffer(offer, senderSocketId, metadata = {}) {
    try {
      if (!senderSocketId) return;

      // 1. Immediately create peer record so incoming candidates are queued per peer
      const peer = this.getOrCreatePeer(senderSocketId, metadata);
      const pc = peer.peerConnection;

      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] offer receiver: received offer from sender participant ID: ${senderSocketId} (${metadata.userName || 'peer'})`);

      // 2. Await local camera/mic so answer contains real tracks
      if (this.mediaPromise) {
        try {
          await this.mediaPromise;
        } catch (e) {
          console.warn('[WEBRTC] Proceeding with answer despite media warning:', e.message);
        }
      }

      this.attachLocalTracksToPeer(peer);

      // 3. Polite peer glare / collision handling (RFC 8829 Perfect Negotiation)
      const isOfferCollision = peer.isMakingOffer || pc.signalingState !== 'stable';
      const isPolite = this.socket?.id ? this.socket.id < senderSocketId : true;

      if (isOfferCollision) {
        console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id} <-> target: ${senderSocketId}] Offer collision detected! signalingState=${pc.signalingState}, isPolite=${isPolite}`);
        if (!isPolite) {
          console.log(`[WEBRTC-DIAG] Impolite peer ignoring colliding offer from ${senderSocketId}`);
          return;
        }
        // Polite peer rolls back local offer to accept remote offer
        await pc.setLocalDescription({ type: 'rollback' });
        console.log(`[WEBRTC-DIAG] Polite peer rolled back local offer for ${senderSocketId}`);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] Remote description (offer) set for ${senderSocketId}`);

      // 4. Flush any queued ICE candidates for this peer
      await this.flushCandidateQueue(peer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('webrtc-answer', {
        roomId: this.roomId,
        targetSocketId: senderSocketId,
        answer
      });
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] answer sender: answer sent to target participant ID: ${senderSocketId}`);
    } catch (err) {
      console.error(`[WEBRTC] Error handling offer from ${senderSocketId}:`, err);
      if (this.onError) this.onError(err);
    }
  }

  // Initiating peer receives answer from callee
  async handleAnswer(answer, senderSocketId) {
    try {
      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] answer receiver: received answer from sender participant ID: ${senderSocketId}`);
      const peer = this.peers.get(senderSocketId);
      if (!peer || !peer.peerConnection) {
        console.warn(`[WEBRTC] handleAnswer: No peer record found for ${senderSocketId}`);
        return;
      }

      if (peer.peerConnection.signalingState === 'have-local-offer') {
        await peer.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] Remote description (answer) set for ${senderSocketId}`);

        // Flush any queued ICE candidates
        await this.flushCandidateQueue(peer);
      }
    } catch (err) {
      console.error(`[WEBRTC] Error handling answer from ${senderSocketId}:`, err);
      if (this.onError) this.onError(err);
    }
  }

  // Handle incoming ICE candidate targeted strictly to a specific peer connection
  async handleIceCandidate(candidate, senderSocketId) {
    try {
      if (!candidate || (!candidate.candidate && candidate.candidate !== '')) return;
      if (!senderSocketId) {
        console.warn('[WEBRTC-DIAG] Discarding ICE candidate: senderSocketId is missing');
        return;
      }

      console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] ICE candidate receiver: candidate received from sender participant ID: ${senderSocketId}`);

      const peer = this.peers.get(senderSocketId);
      if (!peer) {
        // Buffer candidate until peer connection record is created
        if (!this.pendingIceCandidates.has(senderSocketId)) {
          this.pendingIceCandidates.set(senderSocketId, []);
        }
        this.pendingIceCandidates.get(senderSocketId).push(candidate);
        console.log(`[WEBRTC-DIAG] Buffered ICE candidate in pendingIceCandidates for ${senderSocketId}`);
        return;
      }

      const pc = peer.peerConnection;
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`[WEBRTC-DIAG] Applied ICE candidate immediately for ${senderSocketId}`);
        } catch (e) {
          console.warn(`[WEBRTC-DIAG] Error adding ICE candidate for ${senderSocketId}:`, e.message);
        }
      } else {
        peer.candidateQueue.push(candidate);
        console.log(`[WEBRTC-DIAG] Queued ICE candidate in peer.candidateQueue for ${senderSocketId} (remoteDescription pending)`);
      }
    } catch (err) {
      console.error('[WEBRTC] Error in handleIceCandidate:', err);
    }
  }

  // Remove a peer when they leave the interview room
  removePeer(peerSocketId) {
    if (!peerSocketId) return;

    this.pendingIceCandidates.delete(peerSocketId);

    if (!this.peers.has(peerSocketId)) return;

    const peer = this.peers.get(peerSocketId);
    console.log(`[WEBRTC-DIAG] [participant: ${this.socket?.id}] removing peer connection for ${peer.userName} (${peerSocketId})`);

    try {
      if (peer.peerConnection) {
        peer.peerConnection.close();
      }
    } catch (e) {
      console.warn('Error closing peer connection:', e.message);
    }

    this.peers.delete(peerSocketId);
    this.notifyParticipantsChange();

    if (this.onRemoteStreamRemoved) {
      this.onRemoteStreamRemoved(peerSocketId);
    }
  }

  // Notify UI subscribers with clean array of remote participants
  notifyParticipantsChange() {
    const list = Array.from(this.peers.values()).map((p) => ({
      socketId: p.socketId,
      userName: p.userName,
      role: p.role,
      stream: p.remoteStream,
      hasTracks: Boolean(p.remoteStream && p.remoteStream.getTracks && p.remoteStream.getTracks().length > 0),
      connectionState: p.connectionState
    }));

    if (this.onParticipantsChange) {
      this.onParticipantsChange(list);
    }
  }

  // Toggle microphone across all mesh connections
  toggleAudio() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        this.isAudioMuted = !this.isAudioMuted;
        audioTracks.forEach((t) => {
          t.enabled = !this.isAudioMuted;
        });
        console.log('[WEBRTC] Microphone toggled, enabled:', !this.isAudioMuted);
        return !this.isAudioMuted;
      }
    }
    return false;
  }

  // Toggle camera across all mesh connections
  toggleVideo() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        this.isVideoOff = !this.isVideoOff;
        videoTracks.forEach((t) => {
          t.enabled = !this.isVideoOff;
        });
        console.log('[WEBRTC] Camera toggled, enabled:', !this.isVideoOff);
        return !this.isVideoOff;
      }
    }
    return false;
  }

  // Close all mesh connections and stop local media tracks
  close() {
    console.log('[WEBRTC] Closing all mesh connections and stopping media tracks...');
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }

    for (const peer of this.peers.values()) {
      try {
        peer.peerConnection.close();
      } catch (e) {
        // Ignore
      }
    }
    this.peers.clear();
    this.mediaPromise = null;
    this.notifyParticipantsChange();
  }
}
