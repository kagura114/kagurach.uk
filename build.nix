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
    cp -r ./public /var/www/blog/
    chown -R www-data /var/www/blog/
  '';
}