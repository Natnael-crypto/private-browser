import React from 'react';
import { View, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { F, Ic, T } from '../theme/tokens';

interface VideoPlayerModalProps {
  visible: boolean;
  fileUri: string | null;
  title: string;
  meta?: string;
  onClose: () => void;
  onSaveToPhone?: () => void;
  onShare?: () => void;
}

export default function VideoPlayerModal({
  visible,
  fileUri,
  title,
  meta,
  onClose,
  onSaveToPhone,
  onShare,
}: VideoPlayerModalProps) {
  if (!visible || !fileUri) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <PlayerContent
        fileUri={fileUri}
        title={title}
        meta={meta}
        onClose={onClose}
        onSaveToPhone={onSaveToPhone}
        onShare={onShare}
      />
    </Modal>
  );
}

function PlayerContent({
  fileUri,
  title,
  meta,
  onClose,
  onSaveToPhone,
  onShare,
}: {
  fileUri: string;
  title: string;
  meta?: string;
  onClose: () => void;
  onSaveToPhone?: () => void;
  onShare?: () => void;
}) {
  const player = useVideoPlayer(fileUri, (p) => {
    p.loop = true;
    p.play();
  });

  return (
    <View style={s.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={s.headerSafe}>
        <View style={s.header}>
          <Pressable
            accessibilityLabel="Close video player"
            onPress={() => {
              try {
                player.pause();
              } catch {}
              onClose();
            }}
            style={s.closeBtn}
            hitSlop={12}
          >
            <Ic n="x" c="#fff" s={24} w={2.2} />
          </Pressable>

          <View style={s.titleWrap}>
            <T numberOfLines={1} style={s.title}>
              {title || 'Video Player'}
            </T>
            {meta ? (
              <T numberOfLines={1} style={s.meta}>
                {meta}
              </T>
            ) : null}
          </View>

          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Video View */}
      <View style={s.videoWrap}>
        <VideoView
          player={player}
          style={s.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          allowsPictureInPicture
        />
      </View>

      {/* Bottom Action Bar: Move to Downloads & Share (Icon Only) */}
      <View style={s.footerSafe}>
        <View style={s.footer}>
          {onSaveToPhone && (
            <Pressable
              accessibilityLabel="Save to Downloads"
              style={s.iconBtn}
              hitSlop={12}
              onPress={onSaveToPhone}
            >
              <Ic n="dl" c="#fff" s={24} w={2} />
            </Pressable>
          )}

          {onShare && (
            <Pressable
              accessibilityLabel="Share"
              style={s.iconBtn}
              hitSlop={12}
              onPress={onShare}
            >
              <Ic n="share" c="#fff" s={24} w={2} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  headerSafe: {
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: F.s,
    color: '#fff',
    textAlign: 'center',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: F.r,
    marginTop: 2,
  },
  videoWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  footerSafe: {
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
