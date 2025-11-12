Structure

- images: PNG/JPG/SVG (via react-native-svg) for UI.
- fonts: Custom fonts (.ttf/.otf). Link with react-native-asset.
- lottie: Animation JSON files for lottie-react-native.

Usage

- Images: import {Image} from 'react-native'; <Image source={require('./images/logo.png')} />
- Lottie: place JSON in lottie and require it in your component.
- Fonts: drop .ttf/.otf into fonts, then run: npx react-native-asset

