# Motion and font provenance

The storefront's hero photo responds to ordinary page scrolling with a small normalized scale change. The mapping adapts the clamped `scrollProgress` approach from 21st.dev's ScrollExpandMedia component: https://21st.dev/@arunachalam/components/scroll-expansion-hero. This implementation uses passive scroll events and requestAnimationFrame; it does not intercept input or control page scrolling.

MIT License notice for the adapted ScrollExpandMedia technique

Copyright (c) Arunachalam

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Oswald Variable is self-hosted from Google's Fonts repository, `ofl/oswald`, under the SIL Open Font License 1.1. The font file and accompanying license are in `storefront/public/fonts`.
