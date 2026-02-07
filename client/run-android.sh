#!/bin/bash

# NVM node 경로를 PATH에 추가
export PATH="$HOME/.nvm/versions/node/v24.12.0/bin:$PATH"

# Android 빌드 실행
npx expo run:android "$@"
