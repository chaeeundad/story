import { defineConfig, passthroughImageService } from 'astro/config';
export default defineConfig({site:'https://mino.co.kr',output:'static',markdown:{gfm:false,smartypants:false},image:{service:passthroughImageService()}});
