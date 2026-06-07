"use client";

// Importing the config module for its side effect runs Amplify.configure once
// on the client. Rendering null keeps this a pure configuration mount point.
import "@/lib/amplify-config";

export default function ConfigureAmplifyClientSide() {
  return null;
}
