import React, { useState, useEffect } from 'react';
import { X, Settings, Video, Mic, ShieldAlert, Cpu, Check, Activity } from 'lucide-react';
import { VideoQualityProfileId, VIDEO_PROFILES, VIDEO_PROFILE_ORDER } from '@aether/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentProfileId: VideoQualityProfileId;
  onSelectProfile: (profileId: VideoQualityProfileId) => void;
  isDataSaver: boolean;
  onToggleDataSaver: (enabled: boolean) => void;
  degradationPreference: 'maintain-framerate' | 'maintain-resolution' | 'balanced';
  onSelectDegradation: (pref: 'maintain-framerate' | 'maintain-resolution' | 'balanced') => void;
  relayOnly: boolean;
  onToggleRelayOnly: (relay: boolean) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentProfileId,
  onSelectProfile,
  isDataSaver,
  onToggleDataSaver,
  degradationPreference,
  onSelectDegradation,
  relayOnly,
  onToggleRelayOnly,
}) => {
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  useEffect(() => {
    if (isOpen && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
        setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/50">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-gray-300" />
            <h2 className="text-base font-bold text-gray-100">Call & Media Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-gray-300">
          {/* Data Saver Mode Toggle */}
          <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/50 flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <Activity className="w-4 h-4" />
                Data Saver Mode
              </div>
              <p className="text-gray-400">
                Caps video to 240p/15fps, caps Opus audio to 16 kbps with DTX, and pauses non-essential visual elements.
                Ideal for 2G/3G/metered mobile data.
              </p>
            </div>
            <button
              onClick={() => onToggleDataSaver(!isDataSaver)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isDataSaver ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isDataSaver ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Video Quality Profiles */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-blue-400" />
              Target Video Profile
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VIDEO_PROFILE_ORDER.map((id) => {
                const p = VIDEO_PROFILES[id];
                const isSelected = currentProfileId === id;
                return (
                  <button
                    key={id}
                    disabled={isDataSaver && id !== 'low' && id !== 'ultra_low'}
                    onClick={() => onSelectProfile(id)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 text-blue-200 ring-1 ring-blue-500'
                        : 'bg-gray-800/30 border-gray-700/60 text-gray-300 hover:bg-gray-800/60'
                    } ${isDataSaver && id !== 'low' && id !== 'ultra_low' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className="font-bold text-[11px] flex items-center justify-between">
                      {p.label.split('(')[0].trim()}
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </span>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {p.width}×{p.height} · {p.frameRate}fps · {p.targetBitrateKbps} kbps
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Degradation Preference */}
          <div className="space-y-2">
            <label className="font-semibold text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-amber-400" />
              Degradation Preference under Congestion
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'balanced', label: 'Balanced', desc: 'Scales both res & fps' },
                { id: 'maintain-framerate', label: 'Smooth Motion', desc: 'Favors fps for motion' },
                { id: 'maintain-resolution', label: 'Clear Text', desc: 'Favors resolution clarity' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onSelectDegradation(opt.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    degradationPreference === opt.id
                      ? 'bg-amber-950/40 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                      : 'bg-gray-800/30 border-gray-700/60 text-gray-400 hover:bg-gray-800/60'
                  }`}
                >
                  <div className="font-semibold text-[11px]">{opt.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Privacy & IP Relay Mode */}
          <div className="p-4 rounded-xl bg-gray-800/40 border border-gray-700/50 flex items-center justify-between">
            <div className="space-y-1 pr-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                IP Privacy Mode (Force Relay / TURN)
              </div>
              <p className="text-gray-400">
                Prevents leaking your local or public IP address to other call participants by forcing all media through an encrypted TURN relay.
              </p>
            </div>
            <button
              onClick={() => onToggleRelayOnly(!relayOnly)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                relayOnly ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  relayOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
