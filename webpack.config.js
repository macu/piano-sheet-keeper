const VueLoader = require('vue-loader');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
	mode: 'production',
	stats: 'errors-warnings',
	entry: [
		'./src/app.js',
	],
	output: {
		filename: 'app.js',
		path: __dirname + '/compiled',
	},
	optimization: {
		minimize: true,
	},
	performance: {
		hints: 'warning',
		maxEntrypointSize: 250000, // JS output 250 kB
		maxAssetSize: 250000, // CSS output 250 kB
	},
	externals: {
		'jquery': 'jQuery',
	},
	module: {
		rules: [
			{
				test: /\.vue$/,
				loader: 'vue-loader',
			},
			{
				test: /\.js$/,
				// exclude: /(node_modules|bower_components)/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: [
							['@babel/preset-env', { targets: '>1%' }],
						],
					},
				},
			},
			{
				test: /\.s?css$/,
				use: [
					MiniCssExtractPlugin.loader, // add support for `import 'file.scss';` in JS
					{
						loader: 'css-loader',
						options: {
							url: false, // whether to resolve urls; leave urls in the code as written
						},
					},
					{
						loader: 'sass-loader',
						options: {
							sassOptions: {
								includePaths: [
									//__dirname + '/bower_components/bootstrap-sass/assets/stylesheets',
								],
							},
						},
					},
				],
			},
		],
	},
	plugins: [
		new VueLoader.VueLoaderPlugin(),
		new MiniCssExtractPlugin({
			// Output destination for compiled CSS
			filename: '../compiled/app.css',
		}),
	],
};
