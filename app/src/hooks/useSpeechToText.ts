import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useMemo, useState } from "react";

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent("result", (event) => {
    const latest = event.results[0]?.transcript ?? "";
    if (latest) {
      setTranscript(latest);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setError(`${event.error}: ${event.message}`);
    setIsListening(false);
  });

  const actions = useMemo(
    () => ({
      async start() {
        setError("");
        const permission =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!permission.granted) {
          setError("音声認識の権限がありません。");
          return;
        }

        ExpoSpeechRecognitionModule.start({
          lang: "ja-JP",
          interimResults: true,
          continuous: true,
          addsPunctuation: true,
        });
      },
      stop() {
        ExpoSpeechRecognitionModule.stop();
      },
      clear() {
        setTranscript("");
        setError("");
      },
      setTranscript,
    }),
    [],
  );

  return {
    isListening,
    transcript,
    error,
    ...actions,
  };
}
