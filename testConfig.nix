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
    echo "Visit: http://127.0.0.1:11451"
    xdg-open http://127.0.0.1:11451
    caddy file-server --root public --listen :11451
  '';
}