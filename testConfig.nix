let
  pkgs = import <nixpkgs> { };
in pkgs.mkShell rec { 
  buildInputs = with pkgs; [
    yarn
    caddy
    nodejs
  ];
  shellHook = ''
    yarn install
    npx hexo generate
    caddy file-server --root public --listen :11451
  '';
}